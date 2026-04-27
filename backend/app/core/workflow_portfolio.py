from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any


def _safe_number(value: Any) -> float:
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _workflow_name(workflow: Any) -> str:
    return getattr(workflow, "name", None) or f"Workflow {getattr(workflow, 'id', '')}"


def _week_key(date_value: Any) -> str:
    raw = date_value or datetime.now(timezone.utc).isoformat()
    if isinstance(raw, datetime):
        date = raw
    else:
        date = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    start = date - timedelta(days=date.weekday())
    return start.strftime("%Y-%m-%d")


def _serialize_project(project: Any) -> dict[str, Any]:
    return {
        "id": getattr(project, "id", None),
        "name": getattr(project, "name", ""),
        "status": getattr(project, "status", ""),
        "owner": getattr(project, "owner", None),
        "priority": getattr(project, "priority", None),
        "health": getattr(project, "health", None),
        "progress_percent": getattr(project, "progress_percent", 0.0),
        "workflow_ids": list(getattr(project, "workflow_ids", None) or []),
        "traceability": getattr(project, "traceability", None) or {},
        "benefits_realization": getattr(project, "benefits_realization", None) or {},
        "delivery_metrics": getattr(project, "delivery_metrics", None) or {},
        "exception_governance": getattr(project, "exception_governance", None) or {},
    }


def _iso_value(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def build_portfolio_insights(workflows: list[Any], executions: list[Any], projects: list[Any]) -> dict[str, Any]:
    workflow_map = {getattr(workflow, "id", None): workflow for workflow in workflows}
    execution_trends: dict[str, dict[str, float]] = defaultdict(lambda: {"manual": 0.0, "actual": 0.0, "exceptions": 0.0, "recovery": 0.0, "saved": 0.0})
    workflow_execution_groups: dict[int, list[Any]] = defaultdict(list)

    for execution in executions:
        week = _week_key(getattr(execution, "execution_started_at", None) or getattr(execution, "created_at", None))
        baseline = _safe_number(getattr(execution, "baseline_manual_minutes", 0.0))
        actual = _safe_number(getattr(execution, "actual_duration_minutes", 0.0))
        recovery = _safe_number(getattr(execution, "recovery_time_minutes", 0.0))
        exceptions = _safe_number(getattr(execution, "exception_count", 0.0))
        execution_trends[week]["manual"] += baseline
        execution_trends[week]["actual"] += actual
        execution_trends[week]["recovery"] += recovery
        execution_trends[week]["exceptions"] += exceptions
        execution_trends[week]["saved"] += max(baseline - actual, 0.0)
        workflow_execution_groups[getattr(execution, "workflow_id", 0)].append(execution)

    trend_data = [
        {"week": week, **values}
        for week, values in sorted(execution_trends.items(), key=lambda item: item[0])[-12:]
    ]

    benchmark_views = []
    candidate_queue = []
    recognition = []
    traceability_rows = []
    exception_hotspots = []
    review_queue = []
    stale_queue = []
    approval_queue = []
    recertification_queue = []
    rollout_readiness = []

    owner_counts: dict[str, int] = defaultdict(int)
    owner_savings: dict[str, float] = defaultdict(float)
    team_savings: dict[str, float] = defaultdict(float)
    standards_usage: dict[str, int] = defaultdict(int)
    prc_savings: dict[str, float] = defaultdict(float)
    workflow_type_savings: dict[str, float] = defaultdict(float)
    org_savings: dict[str, float] = defaultdict(float)

    for workflow in workflows:
        analysis = getattr(workflow, "analysis", None) or {}
        execution_group = workflow_execution_groups.get(getattr(workflow, "id", 0), [])
        measured_manual = sum(_safe_number(getattr(execution, "baseline_manual_minutes", 0.0)) for execution in execution_group)
        measured_actual = sum(_safe_number(getattr(execution, "actual_duration_minutes", 0.0)) for execution in execution_group)
        measured_saved = max(measured_manual - measured_actual, 0.0)
        measured_recovery = sum(_safe_number(getattr(execution, "recovery_time_minutes", 0.0)) for execution in execution_group)
        measured_exceptions = sum(_safe_number(getattr(execution, "exception_count", 0.0)) for execution in execution_group)
        readiness = _safe_number((analysis.get("scores") or {}).get("readiness", 0.0))
        complexity = _safe_number((analysis.get("scores") or {}).get("complexity_risk", 0.0))
        standardization = _safe_number((analysis.get("scores") or {}).get("standardization", 0.0))
        automation_candidate_score = round(readiness * 0.45 + standardization * 0.2 + min(_safe_number(getattr(workflow, "total_roi_saved_hours", 0.0)) * 4.0, 35.0) - complexity * 0.15, 1)
        owner = ((getattr(workflow, "ownership", None) or {}).get("owner") or (getattr(workflow, "access_control", None) or {}).get("owner") or "Unassigned")
        team = getattr(workflow, "team", None) or "Unassigned"
        owner_counts[owner] += 1
        owner_savings[owner] += measured_saved
        team_savings[team] += measured_saved
        prc_savings[getattr(workflow, "prc", None) or "Unassigned"] += measured_saved
        workflow_type_savings[getattr(workflow, "workflow_type", None) or "Unclassified"] += measured_saved
        org_savings[getattr(workflow, "org", None) or "Department Default"] += measured_saved
        for flag in ((getattr(workflow, "governance", None) or {}).get("standards_flags") or []):
            standards_usage[flag] += 1

        benchmark_views.append(
            {
                "workflow_id": getattr(workflow, "id", None),
                "name": _workflow_name(workflow),
                "workflow_type": getattr(workflow, "workflow_type", None),
                "team": team,
                "prc": getattr(workflow, "prc", None),
                "projected_weekly_hours": round(_safe_number(getattr(workflow, "total_roi_saved_hours", 0.0)), 2),
                "measured_saved_minutes": round(measured_saved, 2),
                "measured_recovery_minutes": round(measured_recovery, 2),
                "measured_exception_count": int(measured_exceptions),
                "readiness": readiness,
                "standardization": standardization,
                "complexity_risk": complexity,
                "certification_state": (analysis.get("certification") or {}).get("state", "Draft"),
            }
        )
        candidate_queue.append(
            {
                "workflow_id": getattr(workflow, "id", None),
                "name": _workflow_name(workflow),
                "candidate_score": automation_candidate_score,
                "projected_hours_saved_weekly": round(_safe_number(getattr(workflow, "total_roi_saved_hours", 0.0)), 2),
                "readiness": readiness,
                "standardization": standardization,
                "complexity_risk": complexity,
                "top_opportunity": ((analysis.get("recommendations") or [{}])[0] or {}).get("title", "Tighten workflow definition"),
            }
        )
        traceability_rows.append(
            {
                "workflow_id": getattr(workflow, "id", None),
                "workflow_name": _workflow_name(workflow),
                "workflow_version": getattr(workflow, "version", 1),
                "project_ids": [getattr(project, "id", None) for project in projects if getattr(workflow, "id", None) in (getattr(project, "workflow_ids", None) or [])],
                "review_state": getattr(workflow, "review_state", "Draft"),
                "approval_state": getattr(workflow, "approval_state", "Draft"),
                "certification_state": (analysis.get("certification") or {}).get("state", "Draft"),
            }
        )
        if measured_exceptions or measured_recovery:
            exception_hotspots.append(
                {
                    "workflow_id": getattr(workflow, "id", None),
                    "name": _workflow_name(workflow),
                    "exceptions": int(measured_exceptions),
                    "recovery_minutes": round(measured_recovery, 1),
                    "top_node": ((analysis.get("task_diagnostic_summary") or {}).get("top_risk_nodes") or ["No hotspot detected"])[0],
                }
            )
        certification = analysis.get("certification") or {}
        if getattr(workflow, "review_state", "Draft") not in {"Approved", "Completed"} or any(request.get("status") == "open" for request in (getattr(workflow, "review_requests", None) or [])):
            review_queue.append(
                {
                    "workflow_id": getattr(workflow, "id", None),
                    "name": _workflow_name(workflow),
                    "review_state": getattr(workflow, "review_state", "Draft"),
                    "required_roles": ((getattr(workflow, "governance", None) or {}).get("required_reviewer_roles") or []),
                    "owner": owner,
                    "due_at": ((getattr(workflow, "governance", None) or {}).get("review_due_at")),
                }
            )
        updated_at = getattr(workflow, "updated_at", None) or getattr(workflow, "created_at", None)
        if updated_at and isinstance(updated_at, datetime):
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
            
            stale_after_days = ((getattr(workflow, "governance", None) or {}).get("stale_after_days") or 90)
            if updated_at < datetime.now(timezone.utc) - timedelta(days=stale_after_days):
                stale_queue.append(
                    {
                        "workflow_id": getattr(workflow, "id", None),
                        "name": _workflow_name(workflow),
                        "owner": owner,
                        "days_stale": max((datetime.now(timezone.utc) - updated_at).days, 0),
                        "stale_after_days": stale_after_days,
                    }
                )
        if getattr(workflow, "approval_state", "Draft") not in {"Approved", "Certified"}:
            approval_queue.append(
                {
                    "workflow_id": getattr(workflow, "id", None),
                    "name": _workflow_name(workflow),
                    "approval_state": getattr(workflow, "approval_state", "Draft"),
                    "owner": owner,
                    "readiness": readiness,
                }
            )
        if certification.get("needs_recertification"):
            recertification_queue.append(
                {
                    "workflow_id": getattr(workflow, "id", None),
                    "name": _workflow_name(workflow),
                    "state": certification.get("state", "Draft"),
                    "summary": certification.get("summary", "Recertification should be completed."),
                }
            )
        rollout_readiness.append(
            {
                "workflow_id": getattr(workflow, "id", None),
                "name": _workflow_name(workflow),
                "owner": owner,
                "readiness": readiness,
                "standardization": standardization,
                "completeness": _safe_number((analysis.get("scores") or {}).get("documentation_completeness", 0.0)),
                "certification_state": certification.get("state", "Draft"),
            }
        )

    candidate_queue = sorted(candidate_queue, key=lambda item: item["candidate_score"], reverse=True)[:8]
    benchmark_views = sorted(benchmark_views, key=lambda item: item["projected_weekly_hours"], reverse=True)
    exception_hotspots = sorted(exception_hotspots, key=lambda item: (item["exceptions"], item["recovery_minutes"]), reverse=True)[:8]
    review_queue = sorted(review_queue, key=lambda item: item.get("due_at") or "")[:10]
    stale_queue = sorted(stale_queue, key=lambda item: item["days_stale"], reverse=True)[:10]
    approval_queue = sorted(approval_queue, key=lambda item: item["readiness"], reverse=True)[:10]
    recertification_queue = recertification_queue[:10]
    rollout_readiness = sorted(rollout_readiness, key=lambda item: (item["readiness"], item["standardization"]), reverse=True)[:10]

    for owner, count in sorted(owner_counts.items(), key=lambda item: (owner_savings[item[0]], item[1]), reverse=True)[:6]:
        recognition.append(
            {
                "label": owner,
                "count": count,
                "saved_minutes": round(owner_savings[owner], 1),
                "badge": "Impact Driver" if owner_savings[owner] > 0 else "Workflow Champion",
            }
        )

    realized_hours = round(sum(max(_safe_number(getattr(execution, "baseline_manual_minutes", 0.0)) - _safe_number(getattr(execution, "actual_duration_minutes", 0.0)), 0.0) for execution in executions) / 60.0, 2)
    projected_hours = round(sum(_safe_number(getattr(workflow, "total_roi_saved_hours", 0.0)) for workflow in workflows), 2)
    delivered_projects = [project for project in projects if getattr(project, "status", "") in {"Deployed", "Done", "Fully Automated"}]
    blocked_projects = [
        project for project in projects
        if getattr(project, "health", "") in {"At Risk", "Blocked"} or (getattr(project, "blocker_summary", None) or [])
    ]
    deployment_queue = [
        project for project in projects
        if getattr(project, "status", "") in {"Validation", "Deployed"}
    ]
    benefits_realization = {
        "projected_hours_weekly": projected_hours,
        "realized_hours_weekly": realized_hours,
        "realization_rate_percent": round((realized_hours / projected_hours) * 100.0, 1) if projected_hours else 0.0,
        "delivered_project_count": len(delivered_projects),
    }

    return {
        "trend_data": trend_data,
        "benchmarking_views": benchmark_views[:12],
        "automation_candidate_queue": candidate_queue,
        "recognition": recognition,
        "contributor_scorecards": [
            {
                "label": owner,
                "workflow_count": count,
                "saved_minutes": round(owner_savings[owner], 1),
                "impact_score": round(owner_savings[owner] + count * 8.0, 1),
            }
            for owner, count in sorted(owner_counts.items(), key=lambda item: (owner_savings[item[0]], item[1]), reverse=True)[:8]
        ],
        "team_rollups": [{"label": label, "saved_minutes": round(saved, 1)} for label, saved in sorted(team_savings.items(), key=lambda item: item[1], reverse=True)[:8]],
        "org_rollups": [{"label": label, "saved_minutes": round(saved, 1)} for label, saved in sorted(org_savings.items(), key=lambda item: item[1], reverse=True)[:8]],
        "prc_rollups": [{"label": label, "saved_minutes": round(saved, 1)} for label, saved in sorted(prc_savings.items(), key=lambda item: item[1], reverse=True)[:8]],
        "workflow_type_rollups": [{"label": label, "saved_minutes": round(saved, 1)} for label, saved in sorted(workflow_type_savings.items(), key=lambda item: item[1], reverse=True)[:8]],
        "benefits_realization": benefits_realization,
        "traceability_rows": traceability_rows,
        "standards_library": [{"flag": key, "workflow_count": value} for key, value in sorted(standards_usage.items(), key=lambda item: item[1], reverse=True)],
        "projects": [_serialize_project(project) for project in projects],
        "workflow_operations_center": {
            "review_queue": review_queue,
            "stale_queue": stale_queue,
            "approval_queue": approval_queue,
            "recertification_queue": recertification_queue,
            "blocked_projects": [_serialize_project(project) for project in blocked_projects[:8]],
            "deployment_queue": [_serialize_project(project) for project in deployment_queue[:8]],
            "exception_hotspots": exception_hotspots,
            "rollout_readiness": rollout_readiness,
        },
        "reporting_pack": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "portfolio_health": "Strong" if benefits_realization["realization_rate_percent"] >= 70 else "Developing",
            "summary_cards": [
                {"label": "Projected Value", "value": projected_hours, "unit": "h/wk"},
                {"label": "Realized Value", "value": realized_hours, "unit": "h/wk"},
                {"label": "Active Candidates", "value": len(candidate_queue), "unit": "workflows"},
                {"label": "Blocked Projects", "value": len(blocked_projects), "unit": "projects"},
            ],
            "narratives": [
                f"{len(review_queue)} workflows are still in the review queue and should be cleared before wider company rollout." if review_queue else "The review queue is currently under control.",
                f"{len(blocked_projects)} automation projects are signaling delivery risk." if blocked_projects else "No automation projects are currently blocked.",
                f"Top exception hotspot: {exception_hotspots[0]['name']} with {exception_hotspots[0]['exceptions']} exceptions logged." if exception_hotspots else "No major exception hotspots are currently visible.",
            ],
        },
        "executive_narratives": [
            f"Tracked executions have realized about {realized_hours:.1f} hours per week back to the department against {projected_hours:.1f} projected hours.",
            f"The strongest automation candidate queue is led by {candidate_queue[0]['name']}." if candidate_queue else "No automation candidate queue is available yet.",
            f"{len(review_queue)} workflows are still in governance review, and {len(stale_queue)} workflows appear stale enough to threaten standardization.",
        ],
        "shareable_report": {
            "title": "PathOS Executive Rollout Brief",
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "highlights": [
                f"Projected portfolio value: {projected_hours:.1f} hours saved per week.",
                f"Realized portfolio value: {realized_hours:.1f} hours saved per week.",
                f"Top automation candidate: {candidate_queue[0]['name']}." if candidate_queue else "Top automation candidate is still emerging.",
                f"Top contributor: {recognition[0]['label']}." if recognition else "Contributor recognition is still forming.",
            ],
            "queues": {
                "review": len(review_queue),
                "stale": len(stale_queue),
                "approval": len(approval_queue),
                "recertification": len(recertification_queue),
            },
        },
    }
