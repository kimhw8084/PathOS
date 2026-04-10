from ..models.models import Task, Workflow
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

async def calculate_task_roi_contribution(task: Task) -> float:
    """
    Calculates the ROI contribution of a single task in minutes per cycle.
    ROI is calculated only on Active Touch Time.
    Formula: (Active Touch Time * Occurrences) + Σ(Error Probability * Recovery Time)
    """
    touch_time = task.active_touch_time_minutes or 0.0
    occurrences = task.occurrences_per_cycle or 1
    base_touch_time = touch_time * occurrences
    
    error_penalty = 0.0
    if hasattr(task, 'errors') and task.errors:
        for error in task.errors:
            prob = error.probability_percent or 0.0
            rec_time = error.recovery_time_minutes or 0.0
            error_penalty += (prob / 100.0) * rec_time
            
    return base_touch_time + error_penalty

async def update_workflow_roi(workflow: Workflow):
    """
    Sum of ROI for all tasks in a workflow multiplied by frequency (cadence).
    Returns total monthly hours saved.
    """
    total_task_minutes = 0.0
    if hasattr(workflow, 'tasks') and workflow.tasks:
        for task in workflow.tasks:
            if not getattr(task, 'is_deleted', False):
                total_task_minutes += await calculate_task_roi_contribution(task)
    
    cadence_count = workflow.cadence_count or 0.0
    unit = workflow.cadence_unit or "week"
    
    # Scale to monthly frequency
    scale = 1.0
    if unit == "day":
        scale = 30.44
    elif unit == "week":
        scale = 4.34
    elif unit == "month":
        scale = 1.0
    elif unit == "year":
        scale = 1.0 / 12.0
    
    monthly_frequency = cadence_count * scale
    workflow.total_roi_saved_hours = (total_task_minutes * monthly_frequency) / 60.0
    return workflow.total_roi_saved_hours
