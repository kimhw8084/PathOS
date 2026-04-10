from ..models.models import Task, Workflow

def calculate_task_roi_contribution(task: Task) -> float:
    """
    Calculates the ROI contribution of a single task in minutes per cycle.
    ROI is calculated only on Active Touch Time.
    Formula: (Active Touch Time * Occurrences) + Σ(Error Probability * Recovery Time)
    """
    # Base touch time per cycle (minutes)
    touch_time = task.active_touch_time_minutes or 0.0
    occurrences = task.occurrences_per_cycle or 1
    base_touch_time = touch_time * occurrences
    
    # Error penalty contribution per cycle (minutes)
    error_penalty = 0.0
    if task.errors:
        for error in task.errors:
            prob = error.probability_percent or 0.0
            rec_time = error.recovery_time_minutes or 0.0
            error_penalty += (prob / 100.0) * rec_time
            
    return base_touch_time + error_penalty

def update_workflow_roi(workflow: Workflow):
    """
    Sum of ROI for all tasks in a workflow multiplied by frequency.
    Returns total hours saved.
    Formula: Σ(Task ROI Contribution) * Frequency / 60
    """
    total_task_minutes = 0.0
    if workflow.tasks:
        for task in workflow.tasks:
            if not getattr(task, 'is_deleted', False):
                total_task_minutes += calculate_task_roi_contribution(task)
    
    # Apply workflow frequency and convert to hours
    # workflow.frequency is assumed to be in cycles per week/month (as per frequency definition)
    frequency = workflow.frequency or 0.0
    workflow.total_roi_saved_hours = (total_task_minutes * frequency) / 60.0
    return workflow.total_roi_saved_hours
