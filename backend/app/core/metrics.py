from ..models.models import Task, Workflow
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from .workflow_analysis import analyze_workflow

async def calculate_task_roi_contribution(task: Task) -> float:
    """
    Calculates the ROI contribution of a single task in minutes per cycle.
    Formula: (Manual Time * Occurrences) + Σ(Error Probability * Recovery Time)
    Note: We prioritize manual_time_minutes as it is the primary field in the UI.
    """
    manual_time = task.manual_time_minutes or 0.0
    active_time = task.active_touch_time_minutes or 0.0
    # Use the larger of the two to be safe, but usually manual_time is the one.
    touch_time = max(manual_time, active_time)
    
    occurrences = task.occurrence or 1
    base_touch_time = touch_time * occurrences
    
    error_penalty = 0.0
    # Use inspect to see if relationship is loaded to avoid MissingGreenlet
    from sqlalchemy import inspect
    insp = inspect(task)
    if 'errors' in insp.unloaded:
        # If not loaded, we can't await here without a session. 
        # But we assume the caller used selectinload.
        pass
    elif task.errors:
        for error in task.errors:
            prob = error.probability_percent or 0.0
            rec_time = error.recovery_time_minutes or 0.0
            error_penalty += (prob / 100.0) * rec_time
            
    return base_touch_time + error_penalty

async def update_workflow_roi(workflow: Workflow):
    """
    Sum of ROI for all tasks in a workflow multiplied by weekly frequency.
    Standardized to Weekly ($h/wk$) as per requirements.
    """
    total_task_minutes = 0.0
    from sqlalchemy import inspect
    insp = inspect(workflow)
    
    # Check if 'tasks' relationship is loaded. 
    # In async SQLAlchemy, we should have used selectinload.
    # If not loaded, we set it to 0 and log a warning.
    if 'tasks' in insp.unloaded:
        # This is a safety fallback. Ideally, the caller should have loaded it.
        # But we don't want to crash or return stale data.
        import logging
        logging.warning(f"Workflow {workflow.id} tasks not loaded during ROI calculation. ROI may be zeroed.")
        workflow.total_roi_saved_hours = 0.0
    elif workflow.tasks:
        for task in workflow.tasks:
            if not getattr(task, 'is_deleted', False):
                total_task_minutes += await calculate_task_roi_contribution(task)
    else:
        # No tasks found
        workflow.total_roi_saved_hours = 0.0
    
    cadence_count = workflow.cadence_count or 0.0
    unit = workflow.cadence_unit or "week"
    
    # Scale to weekly frequency (SME Standard)
    scale = 1.0
    if unit == "day":
        scale = 7.0
    elif unit == "week":
        scale = 1.0
    elif unit == "month":
        scale = 0.2307 # 1 / 4.333
    elif unit == "year":
        scale = 0.0192 # 1 / 52.14
    
    weekly_frequency = cadence_count * scale
    analysis = analyze_workflow(workflow)
    critical_path_minutes = analysis.get("critical_path_minutes", 0.0) or 0.0
    has_routable_graph = bool(getattr(workflow, "edges", None))
    if has_routable_graph and critical_path_minutes > 0:
        total_task_minutes = critical_path_minutes

    workflow.analysis = analysis
    workflow.simulation = analysis.get("simulation", {})
    # Result in Hours per Week
    workflow.total_roi_saved_hours = (total_task_minutes * weekly_frequency) / 60.0
    return workflow.total_roi_saved_hours
