from ..models.models import Task, Workflow

def calculate_task_roi(task: Task, workflow_frequency: float) -> float:
    """
    Calculates ROI for a single task based on formulas in project.md.
    Base Time Saved = (Task TAT * Occurrences) * Workflow Frequency
    Error Penalty Time = Error Probability * Average Recovery Time
    Total ROI (Time Saved) = Base Time Saved + Error Penalty Time
    """
    # Base time saved per cycle (minutes)
    base_time_per_cycle = task.tat_minutes * task.occurrences_per_cycle
    
    # Error penalty per cycle (minutes)
    # Note: project.md says Error Penalty Time = Error Probability * Average Recovery Time
    # Assuming Error Probability is a percentage (e.g. 0.05 for 5%)
    error_penalty_per_cycle = (task.error_probability / 100.0) * task.recovery_time_minutes
    
    # Total time per cycle (minutes)
    total_time_per_cycle = base_time_per_cycle + error_penalty_per_cycle
    
    # Annualized or Periodic ROI (assuming workflow_frequency is same unit as needed)
    # If frequency is per month, return minutes per month
    return total_time_per_cycle * workflow_frequency

def update_workflow_roi(workflow: Workflow):
    """
    Sum of ROI for all tasks in a workflow.
    Returns total hours saved.
    """
    total_minutes = 0.0
    for task in workflow.tasks:
        total_minutes += calculate_task_roi(task, workflow.frequency)
    
    # Convert to hours
    workflow.total_roi_saved_hours = total_minutes / 60.0
    return workflow.total_roi_saved_hours
