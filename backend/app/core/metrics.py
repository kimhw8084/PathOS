from __future__ import annotations

from statistics import mean, pstdev

from ..models.models import Task, Workflow
from .workflow_analysis import analyze_workflow


def _safe_divide(numerator: float, denominator: float) -> float:
    if not denominator:
        return 0.0
    return numerator / denominator


async def calculate_task_roi_contribution(task: Task) -> float:
    """
    Calculates the ROI contribution of a single task in minutes per cycle.
    Formula: (Manual Time * Occurrences) + Σ(Error Probability * Recovery Time)
    """
    manual_time = task.manual_time_minutes or 0.0
    active_time = task.active_touch_time_minutes or 0.0
    touch_time = max(manual_time, active_time)

    occurrences = task.occurrence or 1
    base_touch_time = touch_time * occurrences

    error_penalty = 0.0
    from sqlalchemy import inspect

    insp = inspect(task)
    if "errors" not in insp.unloaded and task.errors:
        for error in task.errors:
            prob = error.probability_percent or 0.0
            rec_time = error.recovery_time_minutes or 0.0
            error_penalty += (prob / 100.0) * rec_time

    return base_touch_time + error_penalty


def _cadence_to_weekly_frequency(workflow: Workflow) -> float:
    cadence_count = workflow.cadence_count or 0.0
    unit = workflow.cadence_unit or "week"
    scale = 1.0
    if unit == "day":
        scale = 7.0
    elif unit == "week":
        scale = 1.0
    elif unit == "month":
        scale = 0.2307
    elif unit == "year":
        scale = 0.0192
    return cadence_count * scale


def _projected_metrics(workflow: Workflow, analysis: dict) -> dict:
    tasks = [task for task in getattr(workflow, "tasks", []) or [] if not getattr(task, "is_deleted", False)]
    manual_minutes = [float(task.manual_time_minutes or task.active_touch_time_minutes or 0.0) * float(task.occurrence or 1) for task in tasks]
    wait_minutes = [float(task.machine_wait_time_minutes or 0.0) * float(task.occurrence or 1) for task in tasks]
    automation_minutes = [float(task.automation_time_minutes or 0.0) * float(task.occurrence or 1) for task in tasks]
    base_total = sum(manual_minutes)
    auto_total = sum(automation_minutes)
    wait_total = sum(wait_minutes)
    total_active = base_total + auto_total + wait_total

    confidence_margin = 0.0
    if manual_minutes:
        volatility = pstdev(manual_minutes) if len(manual_minutes) > 1 else manual_minutes[0] * 0.15
        confidence_margin = min(volatility + (analysis.get("simulation", {}).get("worst_case_minutes", 0.0) - analysis.get("simulation", {}).get("best_case_minutes", 0.0)) * 0.12, max(base_total * 0.35, 6.0))

    if total_active > 0:
        automation_coverage = ((auto_total + wait_total) / total_active) * 100.0
    else:
        automation_coverage = 0.0

    sensitivity_drivers = [
        {"driver": "Manual Touch Time", "impact_score": round(base_total, 2), "share": round(_safe_divide(base_total, max(base_total + wait_total, 1.0)) * 100.0, 1)},
        {"driver": "Machine Wait Time", "impact_score": round(wait_total, 2), "share": round(_safe_divide(wait_total, max(base_total + wait_total, 1.0)) * 100.0, 1)},
        {
            "driver": "Exception Recovery",
            "impact_score": round(sum(float(item.get("risk_penalty_minutes", 0.0) or 0.0) for item in analysis.get("bottlenecks", [])), 2),
            "share": round(
                _safe_divide(sum(float(item.get("risk_penalty_minutes", 0.0) or 0.0) for item in analysis.get("bottlenecks", [])), max(base_total + wait_total, 1.0)) * 100.0,
                1,
            ),
        },
    ]

    return {
        "projected_manual_minutes_per_run": round(base_total, 2),
        "projected_wait_minutes_per_run": round(wait_total, 2),
        "projected_automation_minutes_per_run": round(auto_total, 2),
        "projected_automation_coverage_percent": round(automation_coverage, 1),
        "projected_confidence_band_minutes": {
            "low": round(max(base_total - confidence_margin, 0.0), 2),
            "expected": round(base_total, 2),
            "high": round(base_total + confidence_margin, 2),
        },
        "sensitivity_analysis": sensitivity_drivers,
    }


async def update_workflow_roi(workflow: Workflow):
    total_task_minutes = 0.0
    from sqlalchemy import inspect

    insp = inspect(workflow)
    if "tasks" in insp.unloaded:
        import logging

        logging.warning("Workflow %s tasks not loaded during ROI calculation. ROI may be zeroed.", workflow.id)
        workflow.total_roi_saved_hours = 0.0
        return workflow.total_roi_saved_hours

    if workflow.tasks:
        for task in workflow.tasks:
            if not getattr(task, "is_deleted", False):
                total_task_minutes += await calculate_task_roi_contribution(task)
    else:
        workflow.total_roi_saved_hours = 0.0

    weekly_frequency = _cadence_to_weekly_frequency(workflow)
    analysis = analyze_workflow(workflow)
    critical_path_minutes = analysis.get("critical_path_minutes", 0.0) or 0.0
    has_routable_graph = bool(getattr(workflow, "edges", None))
    if has_routable_graph and critical_path_minutes > 0:
        total_task_minutes = critical_path_minutes

    workflow.analysis = analysis
    workflow.simulation = analysis.get("simulation", {})
    workflow.total_roi_saved_hours = (total_task_minutes * weekly_frequency) / 60.0

    projected = _projected_metrics(workflow, analysis)
    workflow.analysis = {
        **analysis,
        "portfolio_rollup": {
            **(analysis.get("portfolio_rollup") or {}),
            "weekly_frequency": round(weekly_frequency, 3),
            "projected_weekly_hours_saved": round(workflow.total_roi_saved_hours, 2),
            "confidence_hours_band": {
                "low": round((projected["projected_confidence_band_minutes"]["low"] * weekly_frequency) / 60.0, 2),
                "expected": round((projected["projected_confidence_band_minutes"]["expected"] * weekly_frequency) / 60.0, 2),
                "high": round((projected["projected_confidence_band_minutes"]["high"] * weekly_frequency) / 60.0, 2),
            },
        },
        **projected,
    }
    return workflow.total_roi_saved_hours
