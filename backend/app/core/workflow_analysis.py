from __future__ import annotations

from collections import defaultdict, deque
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from statistics import mean, pstdev
from typing import Any


DECISION_TYPES = {"LOOP", "DECISION", "CONDITION"}
STANDARD_LIBRARY = [
    {"key": "ownership", "label": "Clear Ownership", "flag": "ownership", "description": "Named owner, automation owner, and reviewers are defined."},
    {"key": "validation", "label": "Validation Discipline", "flag": "validation", "description": "Verification steps and validation criteria are documented."},
    {"key": "exceptions", "label": "Exception Capture", "flag": "exceptions", "description": "Errors, blockers, and recovery handling are recorded."},
    {"key": "handoff", "label": "Handoff Readiness", "flag": "handoff", "description": "Shift and ownership transitions are documented."},
    {"key": "roi", "label": "ROI Visibility", "flag": "roi", "description": "The workflow can support measured impact and automation prioritization."},
    {"key": "automation-ready", "label": "Automation Ready", "flag": "automation-ready", "description": "Inputs, outputs, branching, and target systems are precise enough to automate."},
]


def _safe_workflow_tasks(workflow: Any) -> list[Any]:
    try:
        from sqlalchemy import inspect as sa_inspect

        inspection = sa_inspect(workflow)
        if hasattr(inspection, "unloaded") and "tasks" in inspection.unloaded:
            return []
    except Exception:
        pass
    return list(getattr(workflow, "tasks", []) or [])


def _task_node_id(task: Any) -> str:
    return str(getattr(task, "node_id", None) or getattr(task, "id", None) or f"memory-{id(task)}")


def _task_duration_minutes(task: Any, include_risk: bool = False) -> float:
    manual = float(getattr(task, "manual_time_minutes", 0.0) or getattr(task, "active_touch_time_minutes", 0.0) or 0.0)
    machine = float(getattr(task, "machine_wait_time_minutes", 0.0) or getattr(task, "automation_time_minutes", 0.0) or 0.0)
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


def _safe_divide(numerator: float, denominator: float) -> float:
    if not denominator:
        return 0.0
    return numerator / denominator


def _normalize_score(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 1)


def _serialize_task(task: Any) -> dict[str, Any]:
    result = {}
    for key, value in task.__dict__.items():
        if key.startswith("_"):
            continue
        if key in {"workflow", "blockers", "errors", "id", "workflow_id", "created_at", "updated_at", "created_by", "updated_by", "is_deleted"}:
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
        "tasks": [_serialize_task(task) for task in _safe_workflow_tasks(workflow)],
        "edges": deepcopy(getattr(workflow, "edges", []) or []),
    }


def _graph_from_workflow(workflow: Any) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, list[str]], dict[str, list[str]], dict[str, int]]:
    tasks = [task for task in _safe_workflow_tasks(workflow) if not getattr(task, "is_deleted", False)]
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

    sinks = [node_id for node_id in task_map.keys() if len(adjacency.get(node_id, [])) == 0] or order[-1:]
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
    current_tasks = {str(getattr(task, "node_id", None) or getattr(task, "id", None)): _serialize_task(task) for task in _safe_workflow_tasks(workflow)}

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
            "phase_name",
            "subflow_name",
            "task_block_key",
            "decision_details",
        ]
        if any(base_task.get(key) != current_task.get(key) for key in comparable_keys):
            modified.append(node_id)

    return {
        "added_nodes": added,
        "removed_nodes": removed,
        "modified_nodes": modified,
        "has_changes": bool(added or removed or modified),
    }


def _task_risk_penalty(task: Any) -> float:
    error_penalty = sum(
        (float(getattr(error, "probability_percent", 0.0) or 0.0) / 100.0) * float(getattr(error, "recovery_time_minutes", 0.0) or 0.0)
        for error in getattr(task, "errors", []) or []
    )
    blocker_penalty = sum(
        (float(getattr(blocker, "probability_percent", 0.0) or 0.0) / 100.0) * float(getattr(blocker, "average_delay_minutes", 0.0) or 0.0)
        for blocker in getattr(task, "blockers", []) or []
    )
    return error_penalty + blocker_penalty


def _build_bottlenecks(task_map: dict[str, Any], critical_path_nodes: list[str]) -> list[dict[str, Any]]:
    bottlenecks: list[dict[str, Any]] = []
    critical_set = set(critical_path_nodes)
    for node_id, task in task_map.items():
        manual = float(getattr(task, "manual_time_minutes", 0.0) or getattr(task, "active_touch_time_minutes", 0.0) or 0.0)
        wait = float(getattr(task, "machine_wait_time_minutes", 0.0) or 0.0)
        automation = float(getattr(task, "automation_time_minutes", 0.0) or 0.0)
        risk_penalty = _task_risk_penalty(task)
        occurrences = float(getattr(task, "occurrence", 1) or 1.0)
        total = (manual + wait + automation) * occurrences + risk_penalty
        bottlenecks.append(
            {
                "node_id": node_id,
                "task_name": getattr(task, "name", node_id),
                "manual_minutes": round(manual * occurrences, 2),
                "wait_minutes": round(wait * occurrences, 2),
                "automation_minutes": round(automation * occurrences, 2),
                "risk_penalty_minutes": round(risk_penalty, 2),
                "total_burden_minutes": round(total, 2),
                "blocker_count": len(getattr(task, "blockers", []) or []),
                "error_count": len(getattr(task, "errors", []) or []),
                "is_critical_path": node_id in critical_set,
                "owner_team": getattr(task, "owning_team", None),
            }
        )
    return sorted(bottlenecks, key=lambda item: (item["is_critical_path"], item["total_burden_minutes"]), reverse=True)[:8]


def _build_scores(
    workflow: Any,
    task_map: dict[str, Any],
    critical_path_minutes: float,
    decision_issues: list[str],
    orphaned_inputs: list[str],
    disconnected_nodes: list[str],
    unreachable_nodes: list[str],
    cycle_nodes: list[str],
) -> dict[str, float]:
    tasks = list(task_map.values())
    total_tasks = len(tasks) or 1
    governance = getattr(workflow, "governance", None) or {}
    ownership = getattr(workflow, "ownership", None) or {}
    standards_profile = getattr(workflow, "standards_profile", None) or {}

    doc_hits = 0.0
    standard_hits = 0.0
    automation_hits = 0.0
    complexity_penalty = 0.0
    risk_penalty = 0.0

    for task in tasks:
        has_doc = bool(str(getattr(task, "description", "") or "").strip())
        has_io = bool(getattr(task, "source_data_list", None) or getattr(task, "output_data_list", None))
        has_validation = bool(getattr(task, "validation_needed", False) and (getattr(task, "verification_steps", None) or []))
        has_refs = bool(getattr(task, "reference_links", None) or getattr(task, "instructions", None) or getattr(task, "media", None))
        has_system = bool(getattr(task, "target_system", None) or getattr(task, "target_systems", None))
        has_owner = bool(getattr(task, "owning_team", None) or getattr(task, "owner_positions", None))
        if has_doc:
            doc_hits += 1.2
        if has_io:
            doc_hits += 1.0
        if has_validation:
            doc_hits += 0.8
        if has_refs:
            doc_hits += 0.6
        if has_owner:
            standard_hits += 0.6
        if has_validation:
            standard_hits += 0.8
        if getattr(task, "task_type", None) in DECISION_TYPES and getattr(task, "decision_details", None):
            standard_hits += 0.6
        if has_system and has_io:
            automation_hits += 1.0
        if getattr(task, "task_type", None) in DECISION_TYPES and getattr(task, "decision_details", None):
            automation_hits += 0.8
        if getattr(task, "interface_type", None) in {"API", "DB", "File", "GUI"}:
            automation_hits += 0.4
        complexity_penalty += len(getattr(task, "blockers", []) or []) * 2.5
        complexity_penalty += len(getattr(task, "errors", []) or []) * 2.0
        if getattr(task, "task_type", None) in DECISION_TYPES:
            complexity_penalty += 4.0
        if getattr(task, "validation_needed", False):
            complexity_penalty += 1.5
        risk_penalty += _task_risk_penalty(task)

    documentation_score = _normalize_score((doc_hits / (total_tasks * 3.6)) * 100.0)
    standardization_boost = 0.0
    if ownership.get("owner"):
        standardization_boost += 8.0
    if ownership.get("automation_owner"):
        standardization_boost += 6.0
    if governance.get("required_reviewer_roles"):
        standardization_boost += 8.0
    if governance.get("standards_flags"):
        standardization_boost += min(len(governance.get("standards_flags", [])) * 4.0, 16.0)
    if standards_profile.get("controlled_terms"):
        standardization_boost += min(len(standards_profile.get("controlled_terms", [])) * 2.0, 10.0)
    standardization_score = _normalize_score((standard_hits / (total_tasks * 2.0)) * 100.0 + standardization_boost)

    readiness_penalty = 0.0
    readiness_penalty += len(decision_issues) * 8.0
    readiness_penalty += len(orphaned_inputs) * 7.0
    readiness_penalty += len(disconnected_nodes) * 6.0
    readiness_penalty += len(unreachable_nodes) * 6.0
    readiness_penalty += len(cycle_nodes) * 12.0
    readiness_score = _normalize_score(documentation_score * 0.4 + standardization_score * 0.25 + 40.0 + (automation_hits / total_tasks) * 20.0 - readiness_penalty)

    complexity_risk_score = _normalize_score(
        25.0
        + min(len(decision_issues) * 8.0, 20.0)
        + min(len(cycle_nodes) * 15.0, 25.0)
        + min(complexity_penalty, 22.0)
        + min(_safe_divide(critical_path_minutes, 10.0), 12.0)
        + min(_safe_divide(risk_penalty, 5.0), 16.0)
    )

    return {
        "readiness": readiness_score,
        "standardization": standardization_score,
        "documentation_completeness": documentation_score,
        "complexity_risk": complexity_risk_score,
    }


def _build_change_impact(
    task_map: dict[str, Any],
    adjacency: dict[str, list[str]],
    reverse_adjacency: dict[str, list[str]],
    critical_path_nodes: list[str],
) -> dict[str, Any]:
    impacted_nodes: dict[str, dict[str, Any]] = {}
    impacted_systems: set[str] = set()
    impacted_teams: set[str] = set()
    impacted_outputs: set[str] = set()

    for node_id, task in task_map.items():
        downstream = sorted(_reachable(adjacency.get(node_id, []), adjacency))
        upstream = sorted(_reachable(reverse_adjacency.get(node_id, []), reverse_adjacency))
        target_systems = []
        for target in getattr(task, "target_systems", None) or []:
            if isinstance(target, dict):
                target_systems.append(target.get("name") or target.get("label") or "")
        if getattr(task, "target_system", None):
            target_systems.append(getattr(task, "target_system"))
        outputs = [item.get("name") or item.get("id") for item in (getattr(task, "output_data_list", None) or []) if isinstance(item, dict)]
        impacted_nodes[node_id] = {
            "task_name": getattr(task, "name", node_id),
            "downstream_nodes": downstream,
            "upstream_nodes": upstream,
            "impact_radius": len(set(downstream + upstream)),
            "critical_path": node_id in set(critical_path_nodes),
            "systems": sorted({item for item in target_systems if item}),
            "owning_team": getattr(task, "owning_team", None),
            "outputs": [item for item in outputs if item],
        }
        impacted_systems.update(item for item in target_systems if item)
        if getattr(task, "owning_team", None):
            impacted_teams.add(getattr(task, "owning_team"))
        impacted_outputs.update(item for item in outputs if item)

    highest = sorted(
        [{"node_id": key, **value} for key, value in impacted_nodes.items()],
        key=lambda item: (item["critical_path"], item["impact_radius"]),
        reverse=True,
    )[:6]

    return {
        "top_change_nodes": highest,
        "impacted_systems": sorted(impacted_systems),
        "impacted_teams": sorted(impacted_teams),
        "impacted_outputs": sorted(impacted_outputs),
    }


def _build_recommendations(
    workflow: Any,
    bottlenecks: list[dict[str, Any]],
    scores: dict[str, float],
    decision_issues: list[str],
    orphaned_inputs: list[str],
    disconnected_nodes: list[str],
    unreachable_nodes: list[str],
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    if bottlenecks:
        top = bottlenecks[0]
        recommendations.append(
            {
                "kind": "bottleneck",
                "priority": "critical" if top["is_critical_path"] else "high",
                "title": f"Reduce burden in {top['task_name']}",
                "detail": f"{top['total_burden_minutes']:.1f} weighted minutes per run with {top['blocker_count']} blockers and {top['error_count']} errors.",
                "target_node_id": top["node_id"],
            }
        )
    if scores["readiness"] < 70:
        recommendations.append(
            {
                "kind": "automation-readiness",
                "priority": "high",
                "title": "Lift automation readiness before delivery",
                "detail": "Tighten systems, inputs, outputs, and route definitions so the workflow can be automated safely.",
            }
        )
    if scores["documentation_completeness"] < 75:
        recommendations.append(
            {
                "kind": "documentation",
                "priority": "medium",
                "title": "Raise documentation completeness",
                "detail": "Add missing validation steps, evidence, references, and task context to improve trust and reuse.",
            }
        )
    if decision_issues:
        recommendations.append(
            {
                "kind": "decision-logic",
                "priority": "critical",
                "title": "Repair malformed decision routing",
                "detail": f"{len(decision_issues)} decision nodes are missing a clean True / False branch definition.",
                "target_node_id": decision_issues[0],
            }
        )
    if orphaned_inputs or disconnected_nodes or unreachable_nodes:
        recommendations.append(
            {
                "kind": "connectivity",
                "priority": "high",
                "title": "Stabilize workflow routing and lineage",
                "detail": "Resolve orphaned lineage and disconnected tasks before using this workflow as a company standard.",
                "target_node_id": (orphaned_inputs or disconnected_nodes or unreachable_nodes)[0],
            }
        )
    governance = getattr(workflow, "governance", None) or {}
    if not governance.get("last_reviewed_at"):
        recommendations.append(
            {
                "kind": "governance",
                "priority": "medium",
                "title": "Schedule recertification review",
                "detail": "This workflow has not recorded a completed governance review yet.",
            }
        )
    return recommendations[:8]


def _build_certification(workflow: Any, scores: dict[str, float], structural_risk: bool) -> dict[str, Any]:
    governance = getattr(workflow, "governance", None) or {}
    review_state = governance.get("review_state") or getattr(workflow, "review_state", "Draft")
    approval_state = governance.get("approval_state") or getattr(workflow, "approval_state", "Draft")
    stale_after_days = governance.get("stale_after_days", 90)
    last_reviewed_at_raw = governance.get("last_reviewed_at")
    now = datetime.now(timezone.utc)
    last_reviewed_at = None
    if last_reviewed_at_raw:
        try:
            parsed = datetime.fromisoformat(str(last_reviewed_at_raw).replace("Z", "+00:00"))
            last_reviewed_at = parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            last_reviewed_at = None
    review_age_days = (now - last_reviewed_at).days if last_reviewed_at else None
    recertification_due_at = (last_reviewed_at or now) + timedelta(days=stale_after_days)
    is_expired = recertification_due_at < now

    if structural_risk:
        state = "At Risk"
    elif approval_state == "Approved" and review_state == "Approved" and not is_expired and scores["documentation_completeness"] >= 70:
        state = "Certified"
    elif review_state in {"Requested", "In Review"} or approval_state in {"Requested", "In Review"}:
        state = "Pending Review"
    elif is_expired:
        state = "Recertification Due"
    else:
        state = "Draft"

    return {
        "state": state,
        "review_state": review_state,
        "approval_state": approval_state,
        "stale_after_days": stale_after_days,
        "review_age_days": review_age_days,
        "recertification_due_at": recertification_due_at.isoformat(),
        "needs_recertification": is_expired or state == "Recertification Due",
    }


def _build_storytelling(workflow: Any, bottlenecks: list[dict[str, Any]], scores: dict[str, float], critical_path_minutes: float) -> dict[str, Any]:
    lead = bottlenecks[0] if bottlenecks else None
    headline = (
        f"{getattr(workflow, 'name', 'This workflow')} currently consumes about {critical_path_minutes:.1f} critical-path minutes per run."
        if critical_path_minutes
        else f"{getattr(workflow, 'name', 'This workflow')} is captured but has no stable measured path yet."
    )
    if lead:
        summary = (
            f"The heaviest burden sits in {lead['task_name']}, carrying {lead['total_burden_minutes']:.1f} weighted minutes "
            f"with {lead['error_count']} error patterns and {lead['blocker_count']} blockers."
        )
    else:
        summary = "The workflow still needs enough authored detail to expose bottlenecks and savings opportunities."
    executive = (
        f"Automation readiness is {scores['readiness']:.0f}/100, documentation completeness is {scores['documentation_completeness']:.0f}/100, "
        f"and standardization is {scores['standardization']:.0f}/100."
    )
    return {"headline": headline, "summary": summary, "executive_narrative": executive}


def _build_standards_matches(workflow: Any, scores: dict[str, float]) -> list[dict[str, Any]]:
    governance = getattr(workflow, "governance", None) or {}
    standards_flags = set(governance.get("standards_flags", []) or [])
    matches = []
    for item in STANDARD_LIBRARY:
        matched = item["flag"] in standards_flags
        confidence = 100.0 if matched else scores["standardization"] * 0.7
        matches.append({**item, "matched": matched, "confidence": round(confidence, 1)})
    return matches


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
        if isinstance(output, dict) and output.get("id") is not None
    }
    orphaned_inputs = []
    for node_id, task in task_map.items():
        for source in getattr(task, "source_data_list", None) or []:
            if not isinstance(source, dict):
                continue
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
            "manual_minutes": round(float(getattr(task, "manual_time_minutes", 0.0) or 0.0), 2),
            "wait_minutes": round(float(getattr(task, "machine_wait_time_minutes", 0.0) or 0.0), 2),
            "automation_minutes": round(float(getattr(task, "automation_time_minutes", 0.0) or 0.0), 2),
            "risk_penalty_minutes": round(_task_risk_penalty(task), 2),
            "owned": bool(getattr(task, "owning_team", None) or getattr(task, "owner_positions", None)),
            "documented": bool(str(getattr(task, "description", "") or "").strip()),
            "validated": bool(getattr(task, "validation_needed", False) and (getattr(task, "verification_steps", None) or [])),
        }
        for node_id, task in task_map.items()
    }

    bottlenecks = _build_bottlenecks(task_map, critical_path_nodes)
    scores = _build_scores(
        workflow,
        task_map,
        critical_path_minutes,
        decision_issues,
        orphaned_inputs,
        disconnected_nodes,
        unreachable_nodes,
        cycle_nodes,
    )
    change_impact = _build_change_impact(task_map, adjacency, reverse_adjacency, critical_path_nodes)
    recommendations = _build_recommendations(workflow, bottlenecks, scores, decision_issues, orphaned_inputs, disconnected_nodes, unreachable_nodes)
    certification = _build_certification(
        workflow,
        scores,
        bool(cycle_nodes or decision_issues or disconnected_nodes or unreachable_nodes or orphaned_inputs),
    )
    storytelling = _build_storytelling(workflow, bottlenecks, scores, critical_path_minutes)
    standards_matches = _build_standards_matches(workflow, scores)
    task_diagnostic_summary = {
        "warning_nodes": sorted({*decision_issues, *orphaned_inputs}),
        "error_nodes": sorted({*cycle_nodes, *disconnected_nodes, *unreachable_nodes}),
        "top_risk_nodes": [item["node_id"] for item in bottlenecks[:3]],
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
        "bottlenecks": bottlenecks,
        "scores": scores,
        "change_impact": change_impact,
        "recommendations": recommendations,
        "benchmarking": {},
        "certification": certification,
        "storytelling": storytelling,
        "portfolio_rollup": {},
        "opportunity_queue": recommendations[:5],
        "standards_library_matches": standards_matches,
        "task_diagnostic_summary": task_diagnostic_summary,
        "simulation": {
            "best_case_minutes": round(best_case_minutes, 2),
            "worst_case_minutes": round(worst_case_minutes, 2),
            "critical_path_minutes": round(critical_path_minutes, 2),
            "critical_path_nodes": critical_path_nodes,
            "path_count": path_count,
        },
    }
