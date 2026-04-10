import pytest
from app.models.models import Task, Workflow, TaskError
from app.core.metrics import calculate_task_roi_contribution, update_workflow_roi

def test_calculate_task_roi_contribution():
    # Task: 10 min Touch, 5 min Wait, 2 occurrences
    # Error: 10% prob, 30 min recovery
    task = Task(
        active_touch_time_minutes=10.0,
        machine_wait_time_minutes=5.0,
        occurrences_per_cycle=2
    )
    error = TaskError(
        error_type="Human Error",
        probability_percent=10.0,
        recovery_time_minutes=30.0
    )
    task.errors = [error]
    
    # Calculation:
    # Touch = 10.0 * 2 = 20.0
    # Error = 0.1 * 30.0 = 3.0
    # Total = 23.0 min/cycle
    
    roi_contribution = calculate_task_roi_contribution(task)
    assert roi_contribution == 23.0

def test_update_workflow_roi():
    wf = Workflow(frequency=20.0) # 20 cycles/week
    
    # T1: 10 min touch, 1 occurrence, no errors
    t1 = Task(active_touch_time_minutes=10.0, occurrences_per_cycle=1)
    
    # T2: 5 min touch, 2 occurrences, 1 error (20% prob, 50 min recovery)
    t2 = Task(active_touch_time_minutes=5.0, occurrences_per_cycle=2)
    e1 = TaskError(error_type="Test Error", probability_percent=20.0, recovery_time_minutes=50.0)
    t2.errors = [e1]
    
    wf.tasks = [t1, t2]
    
    # T1 Contribution: (10 * 1) = 10 min/cycle
    # T2 Contribution: (5 * 2) + (0.2 * 50) = 10 + 10 = 20 min/cycle
    # Total per cycle = 30 min/cycle
    # Weekly (freq=20) = 30 * 20 = 600 min/week
    # Total hours = 10.0 hours/week
    
    hours = update_workflow_roi(wf)
    assert hours == 10.0
    assert wf.total_roi_saved_hours == 10.0
