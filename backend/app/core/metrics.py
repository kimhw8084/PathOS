from ..models.models import Task, Workflow

def calculate_task_roi_contribution(task: Task) -> float:
    """
    Calculates the ROI contribution of a single task in minutes per cycle.
    ROI is calculated only on Active Touch Time.
    Formula: (Active Touch Time * Occurrences) + Σ(Error Probability * Recovery Time)
    """
    # Base touch time per cycle (minutes)
    base_touch_time = task.active_touch_time_minutes * task.occurrences_per_cycle
    
    # Error penalty contribution per cycle (minutes)
    error_penalty = 0.0
    if task.errors:
        for error in task.errors:
            error_penalty += (error.probability_percent / 100.0) * error.recovery_time_minutes
            
    return base_touch_time + error_penalty

def update_workflow_roi(workflow: Workflow):
    """
    Sum of ROI for all tasks in a workflow multiplied by frequency.
    Returns total hours saved.
    Formula: Σ(Task ROI Contribution) * Frequency / 60
    """
    total_task_minutes = 0.0
    for task in workflow.tasks:
        if not task.is_deleted:
            total_task_minutes += calculate_task_roi_contribution(task)
    
    # Apply workflow frequency and convert to hours
    # workflow.frequency is assumed to be in cycles per week/month (as per frequency definition)
    workflow.total_roi_saved_hours = (total_task_minutes * workflow.frequency) / 60.0
    return workflow.total_roi_saved_hours
