import random

import pytest

from app.core.metrics import update_workflow_roi
from app.core.workflow_analysis import analyze_workflow, serialize_workflow_snapshot
from app.models.models import Task, TaskError, Workflow


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


def build_random_dag_workflow(seed: int, interior_count: int = 6) -> Workflow:
    rng = random.Random(seed)
    workflow = Workflow(
        name=f"Random DAG {seed}",
        trigger_type="Start",
        trigger_description="Begin",
        output_type="End",
        output_description="Complete",
        cadence_count=rng.choice([1.0, 2.0, 4.0]),
        cadence_unit=rng.choice(["day", "week", "month", "year"]),
    )

    trigger = build_task("node-trigger", "Trigger", "TRIGGER", interface="TRIGGER")
    outcome = build_task("node-outcome", "Outcome", "OUTCOME", interface="OUTCOME")

    task_types = ["System Interaction", "Data Processing"]
    middle_tasks = []
    for index in range(interior_count):
        task_type = rng.choice(task_types)
        task = build_task(
            f"node-{index}",
            f"Task {index}",
            task_type=task_type,
            manual=float(rng.randint(1, 20)),
        )
        if rng.random() < 0.35:
            task.errors = [
                TaskError(
                    error_type="Retry",
                    description="Retry needed",
                    probability_percent=float(rng.choice([5, 10, 25, 50])),
                    recovery_time_minutes=float(rng.choice([5, 10, 20])),
                )
            ]
        middle_tasks.append(task)

    workflow.tasks = [trigger, *middle_tasks, outcome]

    ordered_ids = [task.node_id for task in workflow.tasks]
    edges = []
    for index, source in enumerate(ordered_ids[:-1]):
        for target in ordered_ids[index + 1 :]:
            if source == "node-outcome" or target == "node-trigger":
                continue
            if source == "node-trigger" and rng.random() < 0.6:
                edges.append({"source": source, "target": target, "label": ""})
            elif target == "node-outcome" and rng.random() < 0.5:
                edges.append({"source": source, "target": target, "label": ""})
            elif rng.random() < 0.18:
                edges.append({"source": source, "target": target, "label": ""})

    if not any(edge["source"] == "node-trigger" for edge in edges):
        edges.append({"source": "node-trigger", "target": middle_tasks[0].node_id, "label": ""})
    if not any(edge["target"] == "node-outcome" for edge in edges):
        edges.append({"source": middle_tasks[-1].node_id, "target": "node-outcome", "label": ""})

    for left, right in zip(middle_tasks, middle_tasks[1:]):
        if not any(edge["source"] == left.node_id and edge["target"] == right.node_id for edge in edges):
            edges.append({"source": left.node_id, "target": right.node_id, "label": ""})

    workflow.edges = edges
    return workflow


def test_random_dag_analysis_respects_path_invariants():
    for seed in range(12):
        workflow = build_random_dag_workflow(seed)
        analysis = analyze_workflow(workflow)

        assert analysis["has_cycle"] is False
        assert analysis["critical_path_minutes"] >= analysis["simulation"]["best_case_minutes"]
        assert analysis["critical_path_hours"] == pytest.approx(round(analysis["critical_path_minutes"] / 60.0, 2))
        assert analysis["critical_path_nodes"]
        assert set(analysis["critical_path_nodes"]).issubset({task.node_id for task in workflow.tasks})
        assert analysis["simulation"]["path_count"] >= 1
        assert not analysis["malformed_logic_nodes"]
        assert set(analysis["scores"].keys()) >= {"readiness", "standardization", "documentation_completeness", "complexity_risk"}
        assert isinstance(analysis["bottlenecks"], list)
        assert isinstance(analysis["recommendations"], list)
        assert "state" in analysis["certification"]
        assert "headline" in analysis["storytelling"]


def test_cycle_and_deleted_node_edges_are_detected_and_ignored_safely():
    workflow = Workflow(
        name="Cycle Ignore Deleted",
        trigger_type="Start",
        trigger_description="Begin",
        output_type="End",
        output_description="Finish",
        cadence_count=1.0,
        cadence_unit="week",
    )
    trigger = build_task("trigger", "Trigger", "TRIGGER", interface="TRIGGER")
    a = build_task("a", "A", manual=5.0)
    b = build_task("b", "B", "LOOP", manual=6.0)
    deleted = build_task("deleted", "Deleted", manual=4.0)
    deleted.is_deleted = True
    outcome = build_task("outcome", "Outcome", "OUTCOME", interface="OUTCOME")
    workflow.tasks = [trigger, a, b, deleted, outcome]
    workflow.edges = [
        {"source": "trigger", "target": "a", "label": ""},
        {"source": "a", "target": "b", "label": "True"},
        {"source": "b", "target": "a", "label": ""},
        {"source": "b", "target": "outcome", "label": "False"},
        {"source": "deleted", "target": "outcome", "label": ""},
        {"source": "a", "target": "missing", "label": ""},
    ]

    analysis = analyze_workflow(workflow)
    assert analysis["has_cycle"] is True
    assert "deleted" not in analysis["critical_path_nodes"]
    assert "missing" not in analysis["critical_path_nodes"]


def test_diff_summary_detects_added_removed_and_modified_nodes():
    workflow = Workflow(
        name="Diff Test",
        version=2,
        trigger_type="Start",
        trigger_description="Begin",
        output_type="End",
        output_description="Finish",
        cadence_count=1.0,
        cadence_unit="week",
    )
    trigger = build_task("trigger", "Trigger", "TRIGGER", interface="TRIGGER")
    current = build_task("keep", "Keep", manual=7.0)
    added = build_task("added", "Added", manual=9.0)
    outcome = build_task("outcome", "Outcome", "OUTCOME", interface="OUTCOME")
    workflow.tasks = [trigger, current, added, outcome]
    workflow.edges = [
        {"source": "trigger", "target": "keep", "label": ""},
        {"source": "keep", "target": "added", "label": ""},
        {"source": "added", "target": "outcome", "label": ""},
    ]

    base_workflow = Workflow(name="Base", version=1)
    base_trigger = build_task("trigger", "Trigger", "TRIGGER", interface="TRIGGER")
    base_current = build_task("keep", "Keep", manual=2.0)
    removed = build_task("removed", "Removed", manual=1.0)
    base_outcome = build_task("outcome", "Outcome", "OUTCOME", interface="OUTCOME")
    base_workflow.tasks = [base_trigger, base_current, removed, base_outcome]
    base_workflow.edges = [
        {"source": "trigger", "target": "keep", "label": ""},
        {"source": "keep", "target": "removed", "label": ""},
        {"source": "removed", "target": "outcome", "label": ""},
    ]
    workflow.version_base_snapshot = serialize_workflow_snapshot(base_workflow)

    analysis = analyze_workflow(workflow)
    diff = analysis["diff_summary"]
    assert diff["has_changes"] is True
    assert diff["added_nodes"] == ["added"]
    assert diff["removed_nodes"] == ["removed"]
    assert diff["modified_nodes"] == ["keep"]


@pytest.mark.asyncio
async def test_random_roi_matches_critical_path_when_graph_is_routable():
    scale_by_unit = {
        "day": 7.0,
        "week": 1.0,
        "month": 0.2307,
        "year": 0.0192,
    }

    for seed in range(8):
        workflow = build_random_dag_workflow(seed + 100, interior_count=5)
        analysis = analyze_workflow(workflow)
        hours = await update_workflow_roi(workflow)
        expected = (analysis["critical_path_minutes"] * workflow.cadence_count * scale_by_unit[workflow.cadence_unit]) / 60.0
        assert hours >= 0.0
        assert hours == pytest.approx(expected)
        assert workflow.total_roi_saved_hours == pytest.approx(expected)
        assert workflow.analysis["critical_path_minutes"] == pytest.approx(analysis["critical_path_minutes"])
