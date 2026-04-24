from __future__ import annotations

from collections import defaultdict, deque
from copy import deepcopy
from typing import Any


DECISION_TYPES = {"LOOP", "DECISION", "CONDITION"}


def _task_node_id(task: Any) -> str:
    return str(getattr(task, "node_id", None) or getattr(task, "id", ""))


def _task_duration_minutes(task: Any, include_risk: bool = False) -> float:
    manual = float(getattr(task, "manual_time_minutes", 0.0) or getattr(task, "active_touch_time_minutes", 0.0) or 0.0)
    machine = float(
        getattr(task, "machine_wait_time_minutes", 0.0)
        or getattr(task, "automation_time_minutes", 0.0)
        or 0.0
    )
    occurrence = float(getattr(task, "occurrence", 1) or 1)
    duration = (manual + machine) * occurrence

    if include_risk:
        for error in getattr(task, "errors", []) or []:
            duration += (float(getattr(error, "probability_percent", 0.0) or 0.0) / 100.0) * float(
                getattr(error, "recovery_time_minutes", 0.0) or 0.0
            )
        for blocker in getattr(task, "blockers", []) or []:
            duration += (float(getattr(blocker, "probability_percent", 0.0) or 0.0) / 100.0) * float(
                getattr(blocker, "average_delay_minutes", 0.0) or 0.0
            )
    return duration


def _normalize_label(label: Any) -> str:
    return str(label or "").strip().lower()


def _serialize_task(task: Any) -> dict[str, Any]:
    result = {}
    for key, value in task.__dict__.items():
        if key.startswith("_"):
            continue
        if key in {"workflow", "blockers", "errors"}:
            continue
        result[key] = deepcopy(value)
    result["blockers"] = [
        {
            "blocking_entity": getattr(blocker, "blocking_entity", ""),
            "reason": getattr(blocker, "reason", ""),
            "probability_percent": getattr(blocker, "probability_percent", 0.0),
            "average_delay_minutes": getattr(blocker, "average_delay_minutes", 0.0),
            "standard_mitigation": getattr(blocker, "standard_mitigation", ""),
        }
        for blocker in getattr(task, "blockers", []) or []
    ]
    result["errors"] = [
        {
            "error_type": getattr(error, "error_type", ""),
            "description": getattr(error, "description", ""),
            "probability_percent": getattr(error, "probability_percent", 0.0),
            "recovery_time_minutes": getattr(error, "recovery_time_minutes", 0.0),
            "correction_method": getattr(error, "correction_method", ""),
        }
        for error in getattr(task, "errors", []) or []
    ]
    return result


def serialize_workflow_snapshot(workflow: Any) -> dict[str, Any]:
    return {
        "name": getattr(workflow, "name", ""),
        "version": getattr(workflow, "version", 1),
        "tasks": [_serialize_task(task) for task in getattr(workflow, "tasks", []) or []],
        "edges": deepcopy(getattr(workflow, "edges", []) or []),
    }


def _graph_from_workflow(workflow: Any) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, list[str]], dict[str, list[str]], dict[str, int]]:
    tasks = [task for task in (getattr(workflow, "tasks", []) or []) if not getattr(task, "is_deleted", False)]
    task_map = {_task_node_id(task): task for task in tasks}

    edges = []
    adjacency: dict[str, list[str]] = defaultdict(list)
    reverse_adjacency: dict[str, list[str]] = defaultdict(list)
    indegree = {node_id: 0 for node_id in task_map.keys()}

    for edge in getattr(workflow, "edges", []) or []:
        source = str((edge or {}).get("source", ""))
        target = str((edge or {}).get("target", ""))
        if not source or not target or source not in task_map or target not in task_map:
            continue
        edges.append(edge)
        adjacency[source].append(target)
        reverse_adjacency[target].append(source)
        indegree[target] = indegree.get(target, 0) + 1
        indegree.setdefault(source, 0)

    return task_map, edges, adjacency, reverse_adjacency, indegree


def _find_cycle_nodes(task_map: dict[str, Any], adjacency: dict[str, list[str]]) -> list[str]:
    visited: set[str] = set()
    visiting: set[str] = set()
    cycle_nodes: set[str] = set()

    def dfs(node_id: str) -> None:
        if node_id in visiting:
            cycle_nodes.add(node_id)
            return
        if node_id in visited:
            return

        visiting.add(node_id)
        for neighbor in adjacency.get(node_id, []):
            if neighbor in visiting:
                cycle_nodes.update({node_id, neighbor})
                continue
            dfs(neighbor)
            if neighbor in cycle_nodes:
                cycle_nodes.add(node_id)
        visiting.remove(node_id)
        visited.add(node_id)

    for node_id in task_map.keys():
        dfs(node_id)

    return sorted(cycle_nodes)


def _reachable(start_nodes: list[str], adjacency: dict[str, list[str]]) -> set[str]:
    seen: set[str] = set()
    queue = deque(start_nodes)
    while queue:
        node_id = queue.popleft()
        if node_id in seen:
            continue
        seen.add(node_id)
        queue.extend(adjacency.get(node_id, []))
    return seen


def _topological_order(indegree: dict[str, int], adjacency: dict[str, list[str]]) -> list[str]:
    queue = deque([node_id for node_id, degree in indegree.items() if degree == 0])
    local_indegree = dict(indegree)
    order: list[str] = []
    while queue:
        node_id = queue.popleft()
        order.append(node_id)
        for neighbor in adjacency.get(node_id, []):
            local_indegree[neighbor] -= 1
            if local_indegree[neighbor] == 0:
                queue.append(neighbor)
    return order


def _path_summary(task_map: dict[str, Any], adjacency: dict[str, list[str]], indegree: dict[str, int], weights: dict[str, float]) -> tuple[float, list[str], float, int]:
    order = _topological_order(indegree, adjacency)
    if not order:
        return 0.0, [], 0.0, 0

    roots = [node_id for node_id, degree in indegree.items() if degree == 0]
    distances = {node_id: float("-inf") for node_id in task_map.keys()}
    shortest = {node_id: float("inf") for node_id in task_map.keys()}
    previous: dict[str, str | None] = {node_id: None for node_id in task_map.keys()}
    path_count = {node_id: 0 for node_id in task_map.keys()}

    for root in roots:
        distances[root] = weights.get(root, 0.0)
        shortest[root] = weights.get(root, 0.0)
        path_count[root] = 1

    for node_id in order:
        for neighbor in adjacency.get(node_id, []):
            candidate = distances[node_id] + weights.get(neighbor, 0.0)
            if candidate > distances[neighbor]:
                distances[neighbor] = candidate
                previous[neighbor] = node_id
            shortest_candidate = shortest[node_id] + weights.get(neighbor, 0.0)
            if shortest_candidate < shortest[neighbor]:
                shortest[neighbor] = shortest_candidate
            path_count[neighbor] += max(path_count[node_id], 1)

    sinks = [node_id for node_id in task_map.keys() if len(adjacency.get(node_id, [])) == 0]
    if not sinks:
        sinks = order[-1:]

    critical_sink = max(sinks, key=lambda node_id: distances.get(node_id, 0.0))
    critical_path: list[str] = []
    cursor: str | None = critical_sink
    while cursor:
        critical_path.append(cursor)
        cursor = previous.get(cursor)
    critical_path.reverse()

    best_case = min(shortest.get(node_id, float("inf")) for node_id in sinks)
    best_case = 0.0 if best_case == float("inf") else best_case
    total_paths = sum(max(path_count.get(node_id, 0), 1) for node_id in sinks)

    return max(distances.get(critical_sink, 0.0), 0.0), critical_path, best_case, total_paths


def _diff_summary(workflow: Any) -> dict[str, Any]:
    snapshot = getattr(workflow, "version_base_snapshot", None) or {}
    base_tasks = {str(task.get("node_id") or task.get("id")): task for task in snapshot.get("tasks", []) or []}
    current_tasks = {str(getattr(task, "node_id", None) or getattr(task, "id", None)): _serialize_task(task) for task in getattr(workflow, "tasks", []) or []}

    added = sorted(node_id for node_id in current_tasks.keys() if node_id not in base_tasks)
    removed = sorted(node_id for node_id in base_tasks.keys() if node_id not in current_tasks)
    modified = []
    for node_id in sorted(set(base_tasks.keys()).intersection(current_tasks.keys())):
        base_task = base_tasks[node_id]
        current_task = current_tasks[node_id]
        comparable_keys = [
            "name",
            "description",
            "task_type",
            "manual_time_minutes",
            "automation_time_minutes",
            "machine_wait_time_minutes",
            "occurrence",
            "source_data_list",
            "output_data_list",
            "blockers",
            "errors",
            "instructions",
            "reference_links",
        ]
        if any(base_task.get(key) != current_task.get(key) for key in comparable_keys):
            modified.append(node_id)

    return {
        "added_nodes": added,
        "removed_nodes": removed,
        "modified_nodes": modified,
        "has_changes": bool(added or removed or modified),
    }


def analyze_workflow(workflow: Any) -> dict[str, Any]:
    task_map, edges, adjacency, reverse_adjacency, indegree = _graph_from_workflow(workflow)
    cycle_nodes = _find_cycle_nodes(task_map, adjacency)

    trigger_nodes = [node_id for node_id, task in task_map.items() if getattr(task, "interface", None) == "TRIGGER"]
    outcome_nodes = [node_id for node_id, task in task_map.items() if getattr(task, "interface", None) == "OUTCOME"]
    roots = trigger_nodes or [node_id for node_id, degree in indegree.items() if degree == 0]
    sinks = outcome_nodes or [node_id for node_id in task_map.keys() if len(adjacency.get(node_id, [])) == 0]

    reachable_from_root = _reachable(roots, adjacency)
    can_reach_sink = _reachable(sinks, reverse_adjacency)
    disconnected_nodes = sorted(node_id for node_id in task_map.keys() if node_id not in reachable_from_root or node_id not in can_reach_sink)
    unreachable_nodes = sorted(node_id for node_id in task_map.keys() if node_id not in reachable_from_root)

    decision_issues: list[str] = []
    for node_id, task in task_map.items():
        if getattr(task, "task_type", None) not in DECISION_TYPES:
            continue
        outgoing = [edge for edge in edges if str(edge.get("source")) == node_id]
        labels = set()
        for edge in outgoing:
            edge_label = edge.get("label")
            if isinstance(edge.get("data"), dict):
                edge_label = edge.get("data", {}).get("label") or edge_label
            labels.add(_normalize_label(edge_label))
        normalized_labels = {label for label in labels if label}
        if len(outgoing) != 2 or not {"true", "false"}.issubset(normalized_labels):
            decision_issues.append(node_id)

    valid_output_ids = {
        str(output.get("id"))
        for task in task_map.values()
        for output in (getattr(task, "output_data_list", None) or [])
        if output.get("id") is not None
    }
    orphaned_inputs = []
    for node_id, task in task_map.items():
        for source in getattr(task, "source_data_list", None) or []:
            from_task_id = source.get("from_task_id")
            if from_task_id and str(from_task_id) not in valid_output_ids:
                orphaned_inputs.append(node_id)
                break

    base_weights = {node_id: _task_duration_minutes(task, include_risk=False) for node_id, task in task_map.items()}
    risk_weights = {node_id: _task_duration_minutes(task, include_risk=True) for node_id, task in task_map.items()}
    critical_path_minutes, critical_path_nodes, best_case_minutes, path_count = _path_summary(task_map, adjacency, indegree, base_weights)
    worst_case_minutes, _, _, _ = _path_summary(task_map, adjacency, indegree, risk_weights)

    diagnostics = {
        node_id: {
            "is_decision": getattr(task, "task_type", None) in DECISION_TYPES,
            "blocker_count": len(getattr(task, "blockers", []) or []),
            "error_count": len(getattr(task, "errors", []) or []),
            "orphaned_input": node_id in orphaned_inputs,
            "unreachable": node_id in unreachable_nodes,
            "disconnected": node_id in disconnected_nodes,
            "logic_warning": node_id in decision_issues,
        }
        for node_id, task in task_map.items()
    }

    return {
        "has_cycle": bool(cycle_nodes),
        "cycle_nodes": cycle_nodes,
        "disconnected_nodes": disconnected_nodes,
        "unreachable_nodes": unreachable_nodes,
        "malformed_logic_nodes": sorted(decision_issues),
        "orphaned_inputs": sorted(set(orphaned_inputs)),
        "critical_path_minutes": round(critical_path_minutes, 2),
        "critical_path_hours": round(critical_path_minutes / 60.0, 2),
        "critical_path_nodes": critical_path_nodes,
        "shift_handoff_risk": critical_path_minutes >= 600 or worst_case_minutes >= 600,
        "diff_summary": _diff_summary(workflow),
        "diagnostics": diagnostics,
        "simulation": {
            "best_case_minutes": round(best_case_minutes, 2),
            "worst_case_minutes": round(worst_case_minutes, 2),
            "critical_path_minutes": round(critical_path_minutes, 2),
            "critical_path_nodes": critical_path_nodes,
            "path_count": path_count,
        },
    }
