import pytest
from app.models.models import Task, Workflow
from app.core.metrics import calculate_task_roi, update_workflow_roi

def test_calculate_task_roi():
    # Task: 10 min TAT, 2 occurrences, 10% error prob, 30 min recovery
    # Workflow Frequency: 20 times/month
    task = Task(
        tat_minutes=10.0,
        occurrences_per_cycle=2,
        error_probability=10.0,
        recovery_time_minutes=30.0
    )
    
    # Interpretation:
    # Base = (10 * 2) * 20 = 400
    # Error = (0.1 * 30) * 20 = 60
    # Total = 460 minutes
    
    roi_minutes = calculate_task_roi(task, 20.0)
    assert roi_minutes == 460.0

def test_update_workflow_roi():
    wf = Workflow(frequency=20.0)
    t1 = Task(tat_minutes=10.0, occurrences_per_cycle=1, error_probability=0.0, recovery_time_minutes=0.0)
    t2 = Task(tat_minutes=5.0, occurrences_per_cycle=2, error_probability=20.0, recovery_time_minutes=50.0)
    
    wf.tasks = [t1, t2]
    
    # T1 ROI: (10 * 1 + 0) * 20 = 200
    # T2 ROI: (5 * 2 + 0.2 * 50) * 20 = (10 + 10) * 20 = 400
    # Total minutes = 600
    # Total hours = 10.0
    
    hours = update_workflow_roi(wf)
    assert hours == 10.0
    assert wf.total_roi_saved_hours == 10.0
