import pytest

from app.models.models import Workflow, Task, TaskError
from app.core.workflow_analysis import analyze_workflow
from app.core.metrics import update_workflow_roi


def build_task(node_id: str, name: str, task_type: str = "System Interaction", interface=None, manual=0.0):
    return Task(
        node_id=node_id,
        name=name,
        description=name,
        task_type=task_type,
        interface=interface,
        manual_time_minutes=manual,
        automation_time_minutes=0.0,
        machine_wait_time_minutes=0.0,
        occurrence=1,
        source_data_list=[],
        output_data_list=[],
        blockers=[],
        errors=[],
        media=[],
        reference_links=[],
        instructions=[],
        verification_steps=[],
        owner_positions=[],
    )


def test_analyze_workflow_flags_cycle_and_logic_errors():
    wf = Workflow(
        name="Cycle Test",
        trigger_type="Start",
        trigger_description="Start",
        output_type="End",
        output_description="End",
        cadence_count=1.0,
        cadence_unit="week",
    )
    trigger = build_task("node-trigger", "Start", "TRIGGER", interface="TRIGGER")
    decision = build_task("node-decision", "Decision", "LOOP", manual=5.0)
    task = build_task("node-task", "Task", manual=10.0)
    outcome = build_task("node-outcome", "Outcome", "OUTCOME", interface="OUTCOME")
    wf.tasks = [trigger, decision, task, outcome]
    wf.edges = [
        {"source": "node-trigger", "target": "node-decision", "label": ""},
        {"source": "node-decision", "target": "node-task", "label": "True"},
        {"source": "node-task", "target": "node-decision", "label": ""},
        {"source": "node-task", "target": "node-outcome", "label": ""},
    ]

    analysis = analyze_workflow(wf)
    assert analysis["has_cycle"] is True
    assert "node-decision" in analysis["cycle_nodes"]
    assert "node-decision" in analysis["malformed_logic_nodes"]


@pytest.mark.asyncio
async def test_update_workflow_roi_uses_critical_path_for_branched_flow():
    wf = Workflow(
        name="Critical Path Test",
        trigger_type="Start",
        trigger_description="Start",
        output_type="End",
        output_description="End",
        cadence_count=1.0,
        cadence_unit="week",
    )
    trigger = build_task("node-trigger", "Start", "TRIGGER", interface="TRIGGER")
    branch_a = build_task("node-a", "Branch A", manual=10.0)
    branch_b = build_task("node-b", "Branch B", manual=20.0)
    branch_b.errors = [TaskError(error_type="Retry", description="Retry", probability_percent=50.0, recovery_time_minutes=20.0)]
    outcome = build_task("node-outcome", "Outcome", "OUTCOME", interface="OUTCOME")
    wf.tasks = [trigger, branch_a, branch_b, outcome]
    wf.edges = [
        {"source": "node-trigger", "target": "node-a", "label": "True"},
        {"source": "node-trigger", "target": "node-b", "label": "False"},
        {"source": "node-a", "target": "node-outcome", "label": ""},
        {"source": "node-b", "target": "node-outcome", "label": ""},
    ]

    hours = await update_workflow_roi(wf)
    assert round(hours, 2) == 0.33
    assert round(wf.analysis["critical_path_hours"], 2) == 0.33

def test_analyze_workflow_standards_library_and_governance():
    wf = Workflow(
        name="Standards Test",
        trigger_type="Start",
        trigger_description="Start",
        output_type="End",
        output_description="End",
        org=None, # Missing org
        team="Yield",
    )
    wf.tasks = [
        build_task("node-trigger", "Start", "TRIGGER", interface="TRIGGER"),
        build_task("node-outcome", "Outcome", "OUTCOME", interface="OUTCOME")
    ]
    wf.edges = [{"source": "node-trigger", "target": "node-outcome", "label": ""}]
    
    analysis = analyze_workflow(wf)
    
    # Verify standards library picks up missing org
    matches = analysis.get("standards_library_matches", [])
    ownership_match = next((m for m in matches if m["flag"] == "ownership"), None)
    assert ownership_match is not None
    assert ownership_match["matched"] is False
    
    # Verify scores are generated
    assert "scores" in analysis
    assert "readiness" in analysis["scores"]
    assert "standardization" in analysis["scores"]

