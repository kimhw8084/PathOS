from ..models.models import Task, Workflow
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

async def calculate_task_roi_contribution(task: Task) -> float:
    """
    Calculates the ROI contribution of a single task in minutes per cycle.
    Formula: (Active Touch Time * Occurrences) + Σ(Error Probability * Recovery Time)
    """
    touch_time = task.active_touch_time_minutes or 0.0
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
    """
    total_task_minutes = 0.0
    from sqlalchemy import inspect
    insp = inspect(workflow)
    
    # Check if 'tasks' relationship is loaded
    if 'tasks' not in insp.unloaded and workflow.tasks:
        for task in workflow.tasks:
            if not getattr(task, 'is_deleted', False):
                total_task_minutes += await calculate_task_roi_contribution(task)
    
    cadence_count = workflow.cadence_count or 0.0
    unit = workflow.cadence_unit or "week"
    
    # Scale to weekly frequency
    scale = 1.0
    if unit == "day":
        scale = 7.0
    elif unit == "week":
        scale = 1.0
    elif unit == "month":
        scale = 1.0 / 4.34
    elif unit == "year":
        scale = 1.0 / 52.14
    
    weekly_frequency = cadence_count * scale
    workflow.total_roi_saved_hours = (total_task_minutes * weekly_frequency) / 60.0
    return workflow.total_roi_saved_hours
