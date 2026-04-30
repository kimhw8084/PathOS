from fastapi import APIRouter, Depends, HTTPException, Body, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, attributes
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from ..database import get_db
from ..models.models import Workflow, Task, TaxonomyEnum, Blocker, TaskError, WorkflowExecution, AutomationProject, AppConfig, OrgMember, SavedView
from ..schemas.schemas import WorkflowCreate, WorkflowRead, TaxonomyRead, SavedViewRead
from ..core.audit import log_audit
from ..core.metrics import update_workflow_roi
from ..core.workflow_analysis import serialize_workflow_snapshot, STANDARD_LIBRARY
from ..core.workflow_portfolio import build_portfolio_insights

router = APIRouter()


def _workflow_query():
    return select(Workflow).options(
        selectinload(Workflow.tasks).selectinload(Task.blockers),
        selectinload(Workflow.tasks).selectinload(Task.errors)
    )


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_list(value):
    return value if isinstance(value, list) else []


def _append_activity(workflow: Workflow, event_type: str, message: str, actor: str = "system_user"):
    timeline = _ensure_list(workflow.activity_timeline)
    timeline.insert(0, {
        "id": f"activity-{datetime.now(timezone.utc).timestamp()}",
        "type": event_type,
        "message": message,
        "actor": actor,
        "created_at": _iso_now(),
    })
    workflow.activity_timeline = timeline[:80]
    attributes.flag_modified(workflow, "activity_timeline")


def _upsert_notification(workflow: Workflow, kind: str, title: str, detail: Optional[str] = None):
    feed = _ensure_list(workflow.notification_feed)
    feed.insert(0, {
        "id": f"notif-{datetime.now(timezone.utc).timestamp()}",
        "kind": kind,
        "title": title,
        "detail": detail,
        "read": False,
        "created_at": _iso_now(),
    })
    workflow.notification_feed = feed[:40]
    attributes.flag_modified(workflow, "notification_feed")


def _tokenize(text: str) -> set[str]:
    return {chunk for chunk in "".join(ch.lower() if ch.isalnum() else " " for ch in text).split() if len(chunk) > 2}


def _workflow_search_blob(workflow: Workflow) -> str:
    task_text = " ".join(
        f"{task.name or ''} {task.description or ''} {task.task_type or ''} {task.owning_team or ''} {task.phase_name or ''} {task.subflow_name or ''}"
        for task in getattr(workflow, "tasks", [])
    )
    comment_text = " ".join(comment.get("message", "") for comment in _ensure_list(workflow.comments))
    return " ".join([
        workflow.name or "",
        workflow.description or "",
        workflow.prc or "",
        workflow.workflow_type or "",
        workflow.tool_family or "",
        workflow.tool_id or "",
        workflow.trigger_type or "",
        workflow.output_type or "",
        workflow.team or "",
        workflow.org or "",
        workflow.poc or "",
        task_text,
        comment_text,
    ]).lower()


def _workflow_similarity(source: Workflow, candidate: Workflow) -> float:
    if source.id == candidate.id:
        return 0.0
    score = 0.0
    if source.prc and candidate.prc and source.prc == candidate.prc:
        score += 3.0
    if source.workflow_type and candidate.workflow_type and source.workflow_type == candidate.workflow_type:
        score += 2.5
    if source.team and candidate.team and source.team == candidate.team:
        score += 1.5
    source_tools = {item.strip() for item in (source.tool_id or "").split(",") if item.strip()}
    candidate_tools = {item.strip() for item in (candidate.tool_id or "").split(",") if item.strip()}
    score += min(len(source_tools & candidate_tools), 3) * 1.2
    score += min(len(_tokenize(_workflow_search_blob(source)) & _tokenize(_workflow_search_blob(candidate))), 8) * 0.2
    return score


def _preview_similarity(preview: dict, candidate: Workflow) -> float:
    preview_tokens = _tokenize(" ".join([
        preview.get("name", "") or "",
        preview.get("description", "") or "",
        preview.get("quick_capture_notes", "") or "",
        preview.get("prc", "") or "",
        preview.get("workflow_type", "") or "",
        " ".join(preview.get("tool_family") or []),
        " ".join(preview.get("applicable_tools") or []),
    ]))
    candidate_tokens = _tokenize(_workflow_search_blob(candidate))
    score = min(len(preview_tokens & candidate_tokens), 12) * 0.35
    if preview.get("prc") and preview.get("prc") == candidate.prc:
        score += 3.0
    if preview.get("workflow_type") and preview.get("workflow_type") == candidate.workflow_type:
        score += 2.5
    preview_tools = set(preview.get("applicable_tools") or [])
    candidate_tools = {item.strip() for item in (candidate.tool_id or "").split(",") if item.strip()}
    score += min(len(preview_tools & candidate_tools), 3) * 1.1
    return score


def _workflow_is_stale(workflow: Workflow) -> bool:
    updated_at = workflow.updated_at or workflow.created_at
    if not updated_at:
        return False
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    governance = workflow.governance or {}
    stale_after_days = governance.get("stale_after_days", 90)
    return updated_at < datetime.now(timezone.utc) - timedelta(days=stale_after_days)


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _json_safe(value):
    return jsonable_encoder(value)


def _matches_tokens(blob: str, query: str) -> bool:
    blob = blob.lower()
    query = query.lower()
    if query in blob:
        return True
    tokens = [token for token in _tokenize(query) if token]
    if not tokens:
        return False
    matched = sum(1 for token in tokens if token in blob)
    return matched >= min(2, len(tokens))


def _matches_member_context(member: Optional[OrgMember], workflow: Workflow, payload: dict) -> bool:
    if not member:
        return True
    roles = set(member.roles or [])
    teams = {member.team} if member.team else set()
    member_names = {member.full_name, member.email}
    role_targets = set((workflow.required_reviewer_roles or []) + (workflow.governance or {}).get("required_reviewer_roles", []))
    request_targets = {
        request.get("requested_from") or request.get("role")
        for request in _ensure_list(workflow.review_requests)
        if request.get("status") == "open"
    }
    viewer_targets = set(_ensure_list((workflow.access_control or {}).get("viewers"))) | set(_ensure_list((workflow.access_control or {}).get("editors")))
    inbox_targets = set(_ensure_list(payload.get("mentions"))) | set(_ensure_list(payload.get("teams")))
    return bool(
        member_names & (request_targets | viewer_targets | inbox_targets)
        or roles & role_targets
        or teams & inbox_targets
        or (workflow.ownership or {}).get("owner") in member_names
        or (workflow.ownership or {}).get("automation_owner") in member_names
    )


async def _active_member(db: AsyncSession) -> Optional[OrgMember]:
    config_result = await db.execute(select(AppConfig).where(AppConfig.key == "company_rollout", AppConfig.is_deleted == False))
    config = config_result.scalar_one_or_none()
    active_email = ((config.value or {}) if config else {}).get("active_member_email")
    if active_email:
        member_result = await db.execute(select(OrgMember).where(OrgMember.email == active_email, OrgMember.is_deleted == False))
        member = member_result.scalar_one_or_none()
        if member:
            return member
    member_result = await db.execute(select(OrgMember).where(OrgMember.is_deleted == False).order_by(OrgMember.created_at.asc()))
    return member_result.scalars().first()


def _workflow_policy_overlay(workflow: Workflow, executions: list[WorkflowExecution]) -> dict:
    governance = workflow.governance or {}
    ownership = workflow.ownership or {}
    active_sites = sorted({execution.site for execution in executions if getattr(execution, "site", None)})
    rules = []
    if workflow.workflow_type in {"Automation Study", "Verification", "Shift Handoff"}:
        rules.append({"scope": "workflow-class", "title": "Workflow-Class Review Standard", "detail": "This workflow class requires reviewer-role coverage and measurable validation artifacts.", "severity": "accent"})
    if not ownership.get("automation_owner"):
        rules.append({"scope": "ownership", "title": "Automation Owner Missing", "detail": "Assign an automation owner before treating this as an award-level automation candidate.", "severity": "danger"})
    if governance.get("stale_after_days", 90) <= 60:
        rules.append({"scope": "governance", "title": "Tight Recertification Window", "detail": f"Recertification is due every {governance.get('stale_after_days')} days for this workflow.", "severity": "accent"})
    return {
        "org": workflow.org or "Department Default",
        "team": workflow.team or "Unassigned",
        "sites": active_sites,
        "rules": rules,
    }


def _rollback_preview(workflow: Workflow) -> dict:
    snapshot = workflow.version_base_snapshot or {}
    tasks = snapshot.get("tasks", []) or []
    available = bool(snapshot and tasks)
    return {
        "available": available,
        "source_workflow_id": workflow.id,
        "target_version": max((workflow.version or 1) - 1, 1),
        "task_count": len(tasks),
        "edge_count": len(snapshot.get("edges", []) or []),
        "guardrails": [
            "Rollback creates a new draft instead of overwriting the active workflow.",
            "The current workflow remains intact for audit and comparison.",
            "Review diff signals before promoting the rollback draft.",
        ],
    }


def _workflow_quality_issues(workflow: Workflow) -> list[dict]:
    issues: list[dict] = []
    metadata_fields = {
        "name": (workflow.name or "").strip(),
        "description": (workflow.description or "").strip(),
        "prc": (workflow.prc or "").strip(),
        "workflow_type": (workflow.workflow_type or "").strip(),
        "org": (workflow.org or "").strip(),
        "team": (workflow.team or "").strip(),
        "trigger_type": (workflow.trigger_type or "").strip(),
        "trigger_description": (workflow.trigger_description or "").strip(),
        "output_type": (workflow.output_type or "").strip(),
        "output_description": (workflow.output_description or "").strip(),
    }
    required_fields = [
        ("name", "Workflow name is required."),
        ("description", "Workflow description is required."),
        ("prc", "PRC is required."),
        ("workflow_type", "Workflow type is required."),
        ("org", "Organization is required."),
        ("team", "Team is required."),
        ("trigger_type", "Trigger type is required."),
        ("trigger_description", "Trigger description is required."),
        ("output_type", "Output type is required."),
        ("output_description", "Output description is required."),
    ]
    for field, message in required_fields:
        if len(metadata_fields[field]) == 0:
            issues.append({"severity": "error", "code": f"workflow.{field}", "message": message})

    if float(workflow.cadence_count or 0) <= 0:
        issues.append({"severity": "error", "code": "workflow.cadence_count", "message": "Cadence count must be greater than zero."})
    if not workflow.repeatability_check:
        issues.append({"severity": "error", "code": "workflow.repeatability_check", "message": "Only repeatable, standard workflows should pass intake."})
    access_control = workflow.access_control or {}
    ownership = workflow.ownership or {}
    if not (access_control.get("owner") or ownership.get("owner")):
        issues.append({"severity": "warning", "code": "access.owner", "message": "Access control owner should be populated."})
    if not (access_control.get("visibility") or "").strip():
        issues.append({"severity": "warning", "code": "access.visibility", "message": "Access control visibility should be populated."})
    workflow_type = (workflow.workflow_type or "").lower()
    if "handoff" in workflow_type:
        if not (ownership.get("owner") or "").strip():
            issues.append({"severity": "error", "code": "workflow.handoff_owner", "message": "Shift handoff workflows require a named workflow owner."})
        if len(_ensure_list((workflow.governance or {}).get("required_reviewer_roles"))) == 0:
            issues.append({"severity": "error", "code": "workflow.handoff_review_roles", "message": "Shift handoff workflows require reviewer roles."})
        if len(_ensure_list(ownership.get("smes"))) == 0:
            issues.append({"severity": "warning", "code": "workflow.handoff_sme", "message": "Shift handoff workflows should identify at least one SME."})
    if "automation" in workflow_type:
        if not (ownership.get("automation_owner") or "").strip():
            issues.append({"severity": "error", "code": "workflow.automation_owner", "message": "Automation study workflows require an automation owner."})
        if not (workflow.quick_capture_notes or "").strip():
            issues.append({"severity": "warning", "code": "workflow.automation_context", "message": "Automation-oriented workflows should capture current-state notes."})
        if len(_ensure_list(workflow.review_requests)) == 0:
            issues.append({"severity": "warning", "code": "workflow.automation_review_request", "message": "Automation-oriented workflows should start with at least one review request."})

    tasks = [task for task in getattr(workflow, "tasks", []) or [] if not getattr(task, "is_deleted", False)]
    for task in tasks:
        node_id = str(getattr(task, "node_id", None) or getattr(task, "id", None))
        if not (getattr(task, "name", "") or "").strip():
            issues.append({"severity": "error", "code": "task.name", "message": "Task name is required.", "targetId": node_id})
        if not (getattr(task, "description", "") or "").strip():
            issues.append({"severity": "warning", "code": "task.description", "message": "Task description should be populated.", "targetId": node_id})
        if getattr(task, "validation_needed", False) and not _ensure_list(getattr(task, "verification_steps", None)):
            issues.append({"severity": "error", "code": "task.validation_step", "message": "Verification workflows require validation steps.", "targetId": node_id})

    edges = _ensure_list(workflow.edges)
    task_ids = {str(getattr(task, "node_id", None) or getattr(task, "id", None)) for task in tasks}
    outgoing = {task_id: [] for task_id in task_ids}
    incoming = {task_id: [] for task_id in task_ids}
    for edge in edges:
        source = str((edge or {}).get("source") or "")
        target = str((edge or {}).get("target") or "")
        if source not in task_ids or target not in task_ids:
            continue
        outgoing[source].append(edge)
        incoming[target].append(edge)
        if source == target:
            issues.append({"severity": "error", "code": "edge.self_loop", "message": "Self-loop edges are not allowed.", "targetId": source})

    trigger_task = next((task for task in tasks if getattr(task, "interface", None) == "TRIGGER"), None)
    outcome_task = next((task for task in tasks if getattr(task, "interface", None) == "OUTCOME"), None)
    if trigger_task and incoming.get(str(getattr(trigger_task, "node_id", None) or getattr(trigger_task, "id", None))):
        issues.append({"severity": "error", "code": "graph.trigger_incoming", "message": "Trigger nodes cannot have incoming routes.", "targetId": str(getattr(trigger_task, "node_id", None) or getattr(trigger_task, "id", None))})
    if outcome_task and outgoing.get(str(getattr(outcome_task, "node_id", None) or getattr(outcome_task, "id", None))):
        issues.append({"severity": "error", "code": "graph.outcome_outgoing", "message": "Outcome nodes cannot have outgoing routes.", "targetId": str(getattr(outcome_task, "node_id", None) or getattr(outcome_task, "id", None))})

    if len(task_ids) > 1:
        adjacency = {task_id: set() for task_id in task_ids}
        reverse_adjacency = {task_id: set() for task_id in task_ids}
        for edge in edges:
            source = str((edge or {}).get("source") or "")
            target = str((edge or {}).get("target") or "")
            if source in adjacency and target in adjacency:
                adjacency[source].add(target)
                reverse_adjacency[target].add(source)
        start_nodes = [task_id for task_id in task_ids if len(reverse_adjacency.get(task_id, set())) == 0]
        end_nodes = [task_id for task_id in task_ids if len(adjacency.get(task_id, set())) == 0]
        reachable_from_start = set()
        queue = list(start_nodes)
        while queue:
            current = queue.pop(0)
            if current in reachable_from_start:
                continue
            reachable_from_start.add(current)
            queue.extend(adjacency.get(current, set()))
        reachable_to_end = set()
        queue = list(end_nodes)
        while queue:
            current = queue.pop(0)
            if current in reachable_to_end:
                continue
            reachable_to_end.add(current)
            queue.extend(reverse_adjacency.get(current, set()))
        disconnected_nodes = sorted(node_id for node_id in task_ids if node_id not in reachable_from_start or node_id not in reachable_to_end)
        unreachable_nodes = sorted(node_id for node_id in task_ids if node_id not in reachable_from_start)
        if disconnected_nodes:
            issues.append({"severity": "error", "code": "graph.disconnected", "message": "Workflow contains disconnected nodes.", "targetId": disconnected_nodes[0]})
        if unreachable_nodes:
            issues.append({"severity": "error", "code": "graph.unreachable", "message": "Workflow contains unreachable nodes.", "targetId": unreachable_nodes[0]})

    return issues


def _clone_task_payload(task: Task) -> dict:
    payload = {
        c.name: getattr(task, c.name)
        for c in task.__table__.columns
        if c.name not in {"id", "workflow_id", "created_at", "updated_at", "is_deleted", "created_by", "updated_by"}
    }
    payload["blockers"] = [
        {
            "blocking_entity": blocker.blocking_entity,
            "reason": blocker.reason,
            "probability_percent": blocker.probability_percent,
            "average_delay_minutes": blocker.average_delay_minutes,
            "standard_mitigation": blocker.standard_mitigation,
        }
        for blocker in task.blockers
    ]
    payload["errors"] = [
        {
            "error_type": error.error_type,
            "description": error.description,
            "probability_percent": error.probability_percent,
            "recovery_time_minutes": error.recovery_time_minutes,
            "correction_method": error.correction_method,
        }
        for error in task.errors
    ]
    return payload

@router.post("", response_model=WorkflowRead)
async def create_workflow(workflow_data: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    if not workflow_data.repeatability_check:
        raise HTTPException(
            status_code=400, 
            detail="Workflows must be repeatable processes."
        )
    
    if not workflow_data.output_type or not workflow_data.output_description:
        raise HTTPException(
            status_code=400,
            detail="A workflow must produce a measurable outcome."
        )

    workflow_dict = workflow_data.model_dump()
    if "tool_family" in workflow_dict and isinstance(workflow_dict["tool_family"], list):
        workflow_dict["tool_family"] = ", ".join(workflow_dict["tool_family"])
    
    # applicable_tools is the field name in frontend/schema, tool_id in model
    if "applicable_tools" in workflow_dict:
        val = workflow_dict.pop("applicable_tools")
        if isinstance(val, list):
            workflow_dict["tool_id"] = ", ".join(val)
        else:
            workflow_dict["tool_id"] = val
    workflow_dict.setdefault("ownership", {
        "owner": workflow_dict.get("access_control", {}).get("owner", "system_user"),
        "smes": [],
        "backup_owners": [],
        "automation_owner": None,
        "reviewers": [],
    })
    workflow_dict.setdefault("governance", {
        "lifecycle_stage": "Draft",
        "review_state": "Draft",
        "approval_state": "Draft",
        "required_reviewer_roles": workflow_dict.get("required_reviewer_roles", []),
        "standards_flags": [],
        "stale_after_days": 90,
        "review_due_at": None,
        "last_reviewed_at": None,
    })
    workflow_dict["review_state"] = workflow_dict["governance"].get("review_state", workflow_dict.get("review_state", "Draft"))
    workflow_dict["approval_state"] = workflow_dict["governance"].get("approval_state", workflow_dict.get("approval_state", "Draft"))
    workflow_dict["required_reviewer_roles"] = workflow_dict["governance"].get("required_reviewer_roles", workflow_dict.get("required_reviewer_roles", []))
    workflow_dict.setdefault("review_requests", [])
    workflow_dict.setdefault("activity_timeline", [])
    workflow_dict.setdefault("notification_feed", [])
    workflow_dict.setdefault("related_workflow_ids", [])
    workflow_dict.setdefault("standards_profile", {})

    new_workflow = Workflow(**workflow_dict)
    db.add(new_workflow)
    await db.flush()
    _append_activity(new_workflow, "workflow.created", f"Workflow created in {new_workflow.workspace}.")
    
    await update_workflow_roi(new_workflow)
    
    await log_audit(
        db, 
        action_type="CREATE", 
        table_name="workflows", 
        record_id=new_workflow.id,
        new_state=workflow_data.model_dump(),
        description=f"Initiated workflow: {new_workflow.name}"
    )
    
    await db.commit()
    
    result = await db.execute(_workflow_query().where(Workflow.id == new_workflow.id))
    return result.scalar_one()


@router.get("/insights/overview")
async def workflow_insights(db: AsyncSession = Depends(get_db)):
    result = await db.execute(_workflow_query().where(Workflow.is_deleted == False))
    workflows = result.scalars().all()
    top_people: dict[str, int] = {}
    top_teams: dict[str, int] = {}
    for workflow in workflows:
      owner = (workflow.ownership or {}).get("owner") or (workflow.access_control or {}).get("owner") or workflow.created_by or "Unassigned"
      team = workflow.team or workflow.poc or "Unassigned"
      top_people[owner] = top_people.get(owner, 0) + 1
      top_teams[team] = top_teams.get(team, 0) + 1

    stale = [workflow.id for workflow in workflows if _workflow_is_stale(workflow)]
    awaiting_review = [workflow.id for workflow in workflows if workflow.review_state not in {"Approved", "Completed"}]
    return {
        "workflow_count": len(workflows),
        "stale_workflow_ids": stale,
        "awaiting_review_ids": awaiting_review,
        "top_contributors": sorted(
            [{"label": key, "count": count} for key, count in top_people.items()],
            key=lambda item: item["count"],
            reverse=True,
        )[:6],
        "team_participation": sorted(
            [{"label": key, "count": count} for key, count in top_teams.items()],
            key=lambda item: item["count"],
            reverse=True,
        )[:6],
    }


@router.get("/insights/president")
async def workflow_president_insights(db: AsyncSession = Depends(get_db)):
    workflow_result = await db.execute(_workflow_query().where(Workflow.is_deleted == False))
    execution_result = await db.execute(select(WorkflowExecution).where(WorkflowExecution.is_deleted == False))
    project_result = await db.execute(select(AutomationProject).where(AutomationProject.is_deleted == False))
    workflows = workflow_result.scalars().all()
    executions = execution_result.scalars().all()
    projects = project_result.scalars().all()
    return build_portfolio_insights(workflows, executions, projects)


@router.get("/standards/library")
async def workflow_standards_library():
    return STANDARD_LIBRARY


@router.get("/policy-overlays/{workflow_id}")
async def workflow_policy_overlays(workflow_id: int, db: AsyncSession = Depends(get_db)):
    workflow_result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    execution_result = await db.execute(select(WorkflowExecution).where(WorkflowExecution.workflow_id == workflow_id, WorkflowExecution.is_deleted == False))
    executions = execution_result.scalars().all()
    return _workflow_policy_overlay(workflow, executions)


@router.get("/{workflow_id}/rollback-preview")
async def workflow_rollback_preview(workflow_id: int, db: AsyncSession = Depends(get_db)):
    workflow_result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _rollback_preview(workflow)


@router.get("/global-search")
async def global_search(
    q: str = Query("", min_length=0),
    limit: int = 8,
    db: AsyncSession = Depends(get_db),
):
    workflow_result = await db.execute(_workflow_query().where(Workflow.is_deleted == False))
    project_result = await db.execute(select(AutomationProject).where(AutomationProject.is_deleted == False))
    execution_result = await db.execute(select(WorkflowExecution).where(WorkflowExecution.is_deleted == False))
    view_result = await db.execute(select(SavedView).where(SavedView.is_deleted == False))
    workflows = workflow_result.scalars().all()
    projects = project_result.scalars().all()
    executions = execution_result.scalars().all()
    views = view_result.scalars().all()
    query = q.strip().lower()
    if not query:
        return {"workflows": [], "projects": [], "executions": [], "saved_views": []}

    def project_blob(project: AutomationProject) -> str:
        return " ".join([
            project.name or "",
            project.summary or "",
            project.owner or "",
            project.team or "",
            project.status or "",
            project.next_action or "",
        ]).lower()

    def execution_blob(execution: WorkflowExecution) -> str:
        return " ".join([
            execution.workflow_name_snapshot or "",
            execution.executed_by or "",
            execution.team or "",
            execution.site or "",
            execution.notes or "",
            execution.status or "",
        ]).lower()

    workflow_matches = [
        WorkflowRead.model_validate(item).model_dump(mode="json")
        for item in workflows
        if _matches_tokens(_workflow_search_blob(item), query)
    ][:limit]
    project_matches = [
        {
            "id": item.id,
            "name": item.name,
            "status": item.status,
            "owner": item.owner,
            "team": item.team,
            "projected_hours_saved_weekly": item.projected_hours_saved_weekly,
            "realized_hours_saved_weekly": item.realized_hours_saved_weekly,
        }
        for item in projects
        if _matches_tokens(project_blob(item), query)
    ][:limit]
    execution_matches = [
        {
            "id": item.id,
            "workflow_id": item.workflow_id,
            "workflow_name_snapshot": item.workflow_name_snapshot,
            "executed_by": item.executed_by,
            "team": item.team,
            "site": item.site,
            "status": item.status,
            "actual_duration_minutes": item.actual_duration_minutes,
        }
        for item in executions
        if _matches_tokens(execution_blob(item), query)
    ][:limit]
    return {
        "workflows": workflow_matches,
        "projects": project_matches,
        "executions": execution_matches,
        "saved_views": [
            SavedViewRead.model_validate(item).model_dump(mode="json")
            for item in views
            if any(
                token in " ".join([item.name or "", item.owner_email or "", item.search_text or "", item.scope or ""]).lower()
                for token in _tokenize(query)
            ) or query in " ".join([item.name or "", item.owner_email or "", item.search_text or "", item.scope or ""]).lower()
        ][:limit],
    }


@router.get("/inbox")
async def workflow_inbox(member_email: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    member = None
    if member_email:
        member_result = await db.execute(select(OrgMember).where(OrgMember.email == member_email, OrgMember.is_deleted == False))
        member = member_result.scalar_one_or_none()
    if not member:
        member = await _active_member(db)

    workflow_result = await db.execute(_workflow_query().where(Workflow.is_deleted == False))
    project_result = await db.execute(select(AutomationProject).where(AutomationProject.is_deleted == False))
    workflows = workflow_result.scalars().all()
    projects = project_result.scalars().all()
    items = []

    for workflow in workflows:
        for request in _ensure_list(workflow.review_requests):
            if request.get("status") != "open":
                continue
            payload = {"mentions": [request.get("requested_from"), request.get("requested_by"), request.get("role")], "teams": [workflow.team]}
            if _matches_member_context(member, workflow, payload):
                items.append({
                    "id": f"review-{workflow.id}-{request.get('id') or request.get('role')}",
                    "kind": "review_request",
                    "workflow_id": workflow.id,
                    "request_id": request.get("id"),
                    "title": f"{workflow.name} requires {request.get('role', 'review')} review",
                    "detail": request.get("note") or workflow.description or "Review request pending.",
                    "status": request.get("status"),
                    "due_at": request.get("due_at"),
                    "created_at": request.get("created_at") or workflow.updated_at,
                })
        for notification in _ensure_list(workflow.notification_feed):
            if _matches_member_context(member, workflow, {"mentions": [notification.get("title"), notification.get("detail")], "teams": [workflow.team]}):
                items.append({
                    "id": f"notif-{workflow.id}-{notification.get('id')}",
                    "kind": notification.get("kind") or "notification",
                    "workflow_id": workflow.id,
                    "title": notification.get("title"),
                    "detail": notification.get("detail"),
                    "status": "unread" if not notification.get("read") else "read",
                    "created_at": notification.get("created_at") or workflow.updated_at,
                })

    for project in projects:
        if member and member.full_name not in {project.owner, project.sponsor} and member.team != project.team:
            continue
        items.append({
            "id": f"project-{project.id}",
            "kind": "project_update",
            "project_id": project.id,
            "title": project.name,
            "detail": project.next_action or project.last_update or "Project update available.",
            "status": project.status,
            "created_at": project.updated_at,
        })

    items.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return {
        "member": {"full_name": member.full_name, "email": member.email, "roles": member.roles or [], "team": member.team, "site": member.site} if member else None,
        "items": items[:50],
        "unread_count": sum(1 for item in items if item.get("status") in {"open", "unread", "Requested"}),
    }


@router.get("/governance-center")
async def governance_center(db: AsyncSession = Depends(get_db)):
    result = await db.execute(_workflow_query().where(Workflow.is_deleted == False))
    workflows = result.scalars().all()
    stale = []
    review_queue = []
    approval_queue = []
    recertification_queue = []
    for workflow in workflows:
        if _workflow_is_stale(workflow):
            stale.append(WorkflowRead.model_validate(workflow).model_dump(mode="json"))
        if workflow.review_state not in {"Approved", "Completed"} or any(request.get("status") == "open" for request in _ensure_list(workflow.review_requests)):
            review_queue.append(WorkflowRead.model_validate(workflow).model_dump(mode="json"))
        if workflow.approval_state not in {"Approved", "Certified"}:
            approval_queue.append(WorkflowRead.model_validate(workflow).model_dump(mode="json"))
        certification = (workflow.analysis or {}).get("certification") or {}
        if certification.get("needs_recertification"):
            recertification_queue.append(WorkflowRead.model_validate(workflow).model_dump(mode="json"))
    return {
        "stale_workflows": stale[:12],
        "review_queue": review_queue[:12],
        "approval_queue": approval_queue[:12],
        "recertification_queue": recertification_queue[:12],
        "counts": {
            "stale": len(stale),
            "review": len(review_queue),
            "approval": len(approval_queue),
            "recertification": len(recertification_queue),
        },
    }


@router.get("/search", response_model=List[WorkflowRead])
async def search_workflows(
    q: str = Query("", min_length=0),
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(_workflow_query())
    workflows = result.scalars().all()
    if not include_deleted:
        workflows = [workflow for workflow in workflows if not workflow.is_deleted]
    query = q.strip().lower()
    if not query:
        return workflows[:30]
    tokens = _tokenize(query)
    matched = []
    for workflow in workflows:
        blob = _workflow_search_blob(workflow)
        if query in blob or all(token in blob for token in tokens):
            matched.append(workflow)
    return matched[:30]


@router.get("/discovery/{workflow_id}")
async def discover_related_workflows(workflow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(_workflow_query())
    workflows = result.scalars().all()
    source = next((workflow for workflow in workflows if workflow.id == workflow_id), None)
    if not source:
        raise HTTPException(status_code=404, detail="Workflow not found")
    scored = [
        {"workflow": workflow, "score": _workflow_similarity(source, workflow)}
        for workflow in workflows
        if workflow.id != workflow_id and not workflow.is_deleted
    ]
    related = [item["workflow"] for item in sorted(scored, key=lambda item: item["score"], reverse=True) if item["score"] > 0][:6]
    duplicates = [workflow for workflow in related if workflow.prc == source.prc and workflow.workflow_type == source.workflow_type][:3]
    cross_department = [workflow for workflow in related if workflow.team and workflow.team != source.team][:3]
    reuse_patterns = []
    for workflow in related[:4]:
        analysis = workflow.analysis or {}
        storytelling = analysis.get("storytelling") or {}
        top_recommendation = ((analysis.get("recommendations") or [{}])[0] or {}).get("title")
        reuse_patterns.append(
            {
                "workflow_id": workflow.id,
                "name": workflow.name,
                "pattern": workflow.template_key or workflow.workflow_type or "Operational Pattern",
                "why": top_recommendation or storytelling.get("summary") or workflow.description or "Similar workflow worth reusing.",
            }
        )
    return {
        "related": [WorkflowRead.model_validate(item) for item in related],
        "duplicates": [WorkflowRead.model_validate(item) for item in duplicates],
        "cross_department": [WorkflowRead.model_validate(item) for item in cross_department],
        "reuse_patterns": reuse_patterns,
    }

@router.get("", response_model=List[WorkflowRead])
async def list_workflows(include_deleted: bool = False, db: AsyncSession = Depends(get_db)):
    query = _workflow_query().order_by(Workflow.created_at.desc())
    
    if not include_deleted:
        query = query.where(Workflow.is_deleted == False)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.put("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(workflow_id: int, workflow_data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    expected_updated_at = _parse_iso(workflow_data.get("expected_updated_at"))
    actual_updated_at = workflow.updated_at
    if actual_updated_at and actual_updated_at.tzinfo is None:
        actual_updated_at = actual_updated_at.replace(tzinfo=timezone.utc)
    if expected_updated_at and actual_updated_at and actual_updated_at > expected_updated_at:
        current_workflow = WorkflowRead.model_validate(workflow).model_dump(mode="json")
        return JSONResponse(
            status_code=409,
            content={
                "message": "Save conflict detected. This workflow changed after you opened it. Reload the latest definition before saving again.",
                "current_updated_at": actual_updated_at.isoformat(),
                "current_workflow": current_workflow,
            },
        )
    
    previous_state = {c.name: getattr(workflow, c.name) for c in workflow.__table__.columns}
    
    # Extract tasks if provided
    tasks_data = workflow_data.get("tasks")
    
    # Update workflow fields
    data_to_update = {k: v for k, v in workflow_data.items() if k not in {"tasks", "expected_updated_at"}}
    
    # Handle list to string conversion for tool_family and tool_id
    if "tool_family" in data_to_update and isinstance(data_to_update["tool_family"], list):
        data_to_update["tool_family"] = ", ".join(data_to_update["tool_family"])
    
    if "applicable_tools" in data_to_update:
        val = data_to_update.pop("applicable_tools")
        if isinstance(val, list):
            data_to_update["tool_id"] = ", ".join(val)
        else:
            data_to_update["tool_id"] = val

    for key, value in data_to_update.items():
        if hasattr(workflow, key):
            setattr(workflow, key, value)
            if isinstance(value, (list, dict)):
                attributes.flag_modified(workflow, key)
    if "governance" in data_to_update and isinstance(workflow.governance, dict):
        workflow.review_state = workflow.governance.get("review_state", workflow.review_state)
        workflow.approval_state = workflow.governance.get("approval_state", workflow.approval_state)
        workflow.required_reviewer_roles = workflow.governance.get("required_reviewer_roles", workflow.required_reviewer_roles or [])
        attributes.flag_modified(workflow, "required_reviewer_roles")

    if workflow.review_requests:
        open_requests = [request for request in workflow.review_requests if request.get("status") == "open"]
        if open_requests:
            _upsert_notification(workflow, "review-request", "Workflow has open review requests.", f"{len(open_requests)} reviewer actions are pending.")
    
    await db.flush()
    
    # Sync Tasks if provided
    if tasks_data is not None:
        from .tasks import sync_tasks
        from ..schemas.schemas import TaskCreate
        processed_tasks = []
        for t in tasks_data:
            t_data = t.copy()
            if "workflow_id" in t_data:
                del t_data["workflow_id"]
            processed_tasks.append(TaskCreate(**t_data, workflow_id=workflow_id))
        
        # sync_tasks now only flushes, doesn't commit
        await sync_tasks(workflow_id, processed_tasks, db)

    # After sync_tasks, we need to refresh the workflow.tasks relationship in the session
    # so that update_workflow_roi sees the NEW tasks.
    db.expire(workflow, ['tasks'])
    
    # Reload workflow with all tasks, blockers, and errors for ROI calc
    result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    workflow = result.scalar_one()
    # Recalculate ROI on the reloaded state
    await update_workflow_roi(workflow)
    quality_issues = _workflow_quality_issues(workflow)
    blocking_quality_issues = [issue for issue in quality_issues if issue.get("severity") == "error"]
    if blocking_quality_issues:
        raise HTTPException(
            status_code=400,
            detail=blocking_quality_issues[0].get("message") or "Workflow quality validation failed.",
        )
    _append_activity(workflow, "workflow.updated", f"Workflow updated with {len(tasks_data or [])} authored tasks." if tasks_data is not None else "Workflow metadata updated.")
    analysis = workflow.analysis or {}
    if analysis.get("has_cycle"):
        raise HTTPException(status_code=400, detail="Workflow contains a routing cycle. Remove the infinite loop before saving.")
    if analysis.get("malformed_logic_nodes"):
        raise HTTPException(status_code=400, detail="Decision logic is malformed. Decision nodes require exactly two outgoing True/False routes.")
    if analysis.get("unreachable_nodes") or analysis.get("disconnected_nodes"):
        raise HTTPException(status_code=400, detail="Workflow contains disconnected or unreachable nodes. Connect every task from trigger to outcome before saving.")
        
    await log_audit(
        db,
        action_type="UPDATE",
        table_name="workflows",
        record_id=workflow.id,
        previous_state=previous_state,
        new_state=workflow_data,
        description=f"Updated workflow: {workflow.name} including tasks and edges"
    )
    workflow.updated_at = datetime.now(timezone.utc)
    await db.commit()
    
    # Reload for final return to ensure everything is hydrated
    result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    return result.scalar_one()


@router.post("/{workflow_id}/governance-action", response_model=WorkflowRead)
async def workflow_governance_action(
    workflow_id: int,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    action = payload.get("action")
    actor = payload.get("actor") or "system_user"
    note = payload.get("note") or ""
    request_id = payload.get("request_id")
    governance = workflow.governance or {}
    review_requests = _ensure_list(workflow.review_requests)

    if request_id:
        for request in review_requests:
            if str(request.get("id")) == str(request_id):
                if action in {"approve_review", "approve_workflow", "certify"}:
                    request["status"] = "approved"
                elif action in {"request_changes", "request_recertification"}:
                    request["status"] = "changes_requested"
                request["acted_by"] = actor
                request["acted_at"] = _iso_now()

    if action == "approve_review":
        workflow.review_state = "Approved"
        governance["review_state"] = "Approved"
        governance["last_reviewed_at"] = _iso_now()
    elif action == "request_changes":
        workflow.review_state = "Changes Requested"
        governance["review_state"] = "Changes Requested"
    elif action == "approve_workflow":
        workflow.approval_state = "Approved"
        governance["approval_state"] = "Approved"
        governance["last_reviewed_at"] = _iso_now()
    elif action == "certify":
        workflow.approval_state = "Certified"
        workflow.review_state = "Approved"
        governance["approval_state"] = "Certified"
        governance["review_state"] = "Approved"
        governance["last_reviewed_at"] = _iso_now()
    elif action == "request_recertification":
        workflow.approval_state = "Needs Recertification"
        governance["approval_state"] = "Needs Recertification"
    else:
        raise HTTPException(status_code=400, detail="Unsupported governance action")

    workflow.governance = governance
    workflow.review_requests = review_requests
    attributes.flag_modified(workflow, "governance")
    attributes.flag_modified(workflow, "review_requests")
    if workflow.analysis:
        certification = (workflow.analysis or {}).get("certification") or {}
        if action == "certify":
            certification["state"] = "Certified"
            certification["needs_recertification"] = False
        elif action == "request_recertification":
            certification["state"] = "Needs Recertification"
            certification["needs_recertification"] = True
        workflow.analysis["certification"] = certification
        attributes.flag_modified(workflow, "analysis")
    _append_activity(workflow, f"governance.{action}", note or f"Governance action `{action}` applied.", actor=actor)
    _upsert_notification(workflow, "governance-action", f"{workflow.name} governance updated", note or f"Action `{action}` applied by {actor}.")
    await db.commit()
    refreshed = await db.execute(_workflow_query().where(Workflow.id == workflow.id))
    return refreshed.scalar_one()


@router.post("/{workflow_id}/notifications/{notification_id}/read", response_model=WorkflowRead)
async def mark_workflow_notification_read(
    workflow_id: int,
    notification_id: str,
    payload: dict = Body(default={}),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    found = False
    notifications = _ensure_list(workflow.notification_feed)
    for notification in notifications:
        if str(notification.get("id")) == str(notification_id):
            notification["read"] = True
            notification["read_at"] = _iso_now()
            notification["read_by"] = payload.get("actor") or "system_user"
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Notification not found")

    workflow.notification_feed = notifications
    attributes.flag_modified(workflow, "notification_feed")
    _append_activity(workflow, "notification.read", f"Notification {notification_id} marked read.", actor=payload.get("actor") or "system_user")
    await db.commit()
    refreshed = await db.execute(_workflow_query().where(Workflow.id == workflow.id))
    return refreshed.scalar_one()


@router.post("/{workflow_id}/clone", response_model=WorkflowRead)
async def clone_workflow(
    workflow_id: int,
    mode: str = "clone",
    workspace: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    source_workflow = result.scalar_one_or_none()
    if not source_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    base_snapshot = serialize_workflow_snapshot(source_workflow)
    is_version = mode == "version"
    new_version = (source_workflow.version or 1) + 1 if is_version else 1
    version_group = source_workflow.version_group or f"wf-{source_workflow.id}"

    clone_payload = {
        c.name: getattr(source_workflow, c.name)
        for c in source_workflow.__table__.columns
        if c.name not in {"id", "created_at", "updated_at", "is_deleted"}
    }
    clone_payload.update(
        {
            "name": f"{source_workflow.name} {'v' + str(new_version) if is_version else 'Clone'}",
            "version": new_version,
            "workspace": workspace or "Personal Drafts",
            "status": "Created",
            "parent_workflow_id": source_workflow.id if is_version else source_workflow.parent_workflow_id,
            "version_group": version_group,
            "version_notes": f"{'New version' if is_version else 'Clone'} generated from workflow {source_workflow.id}",
            "version_base_snapshot": base_snapshot if is_version else None,
            "comments": [],
            "analysis": None,
            "simulation": None,
            "activity_timeline": [],
            "notification_feed": [],
            "review_requests": [],
        }
    )

    cloned_workflow = Workflow(**_json_safe(clone_payload))
    db.add(cloned_workflow)
    await db.flush()

    for index, task in enumerate(source_workflow.tasks):
        task_payload = _clone_task_payload(task)
        blockers = task_payload.pop("blockers", [])
        errors = task_payload.pop("errors", [])
        task_payload.pop("order_index", None)
        cloned_task = Task(**task_payload, workflow_id=cloned_workflow.id, order_index=index)
        db.add(cloned_task)
        await db.flush()
        for blocker_payload in blockers:
            db.add(Blocker(**blocker_payload, task_id=cloned_task.id))
        for error_payload in errors:
            db.add(TaskError(**error_payload, task_id=cloned_task.id))

    await db.flush()
    await update_workflow_roi(cloned_workflow)
    _append_activity(
        cloned_workflow,
        "workflow.versioned" if is_version else "workflow.cloned",
        f"{'Version draft' if is_version else 'Clone draft'} created from workflow {workflow_id}.",
    )
    await log_audit(
        db,
        action_type="CREATE",
        table_name="workflows",
        record_id=cloned_workflow.id,
        new_state={"source_workflow_id": workflow_id, "mode": mode},
        description=f"{'Versioned' if is_version else 'Cloned'} workflow from source {workflow_id}",
    )
    await db.commit()

    result = await db.execute(_workflow_query().where(Workflow.id == cloned_workflow.id))
    return result.scalar_one()


@router.post("/{workflow_id}/rollback-draft", response_model=WorkflowRead)
async def create_rollback_draft(
    workflow_id: int,
    workspace: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    source_workflow = result.scalar_one_or_none()
    if not source_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    snapshot = source_workflow.version_base_snapshot or {}
    snapshot_tasks = snapshot.get("tasks", []) or []
    snapshot_edges = snapshot.get("edges", []) or []
    if not snapshot_tasks:
        raise HTTPException(status_code=400, detail="No rollback snapshot is available for this workflow.")

    clone_payload = {
        c.name: getattr(source_workflow, c.name)
        for c in source_workflow.__table__.columns
        if c.name not in {"id", "created_at", "updated_at", "is_deleted"}
    }
    clone_payload.update(
        {
            "name": f"{source_workflow.name} Rollback Draft",
            "workspace": workspace or "Personal Drafts",
            "status": "Created",
            "version_notes": f"Rollback draft generated from version snapshot of workflow {source_workflow.id}.",
            "version_base_snapshot": snapshot,
            "comments": [],
            "analysis": None,
            "simulation": None,
            "activity_timeline": [],
            "notification_feed": [],
            "review_requests": [],
            "edges": snapshot_edges,
        }
    )

    rollback_workflow = Workflow(**_json_safe(clone_payload))
    db.add(rollback_workflow)
    await db.flush()

    for index, task_payload in enumerate(snapshot_tasks):
        payload = dict(task_payload)
        payload.pop("id", None)
        payload.pop("workflow_id", None)
        payload.pop("order_index", None)
        payload.pop("created_at", None)
        payload.pop("updated_at", None)
        payload.pop("is_deleted", None)
        payload.pop("created_by", None)
        payload.pop("updated_by", None)
        blockers = payload.pop("blockers", [])
        errors = payload.pop("errors", [])
        cloned_task = Task(**payload, workflow_id=rollback_workflow.id, order_index=index)
        db.add(cloned_task)
        await db.flush()
        for blocker_payload in blockers:
            db.add(Blocker(**blocker_payload, task_id=cloned_task.id))
        for error_payload in errors:
            db.add(TaskError(**error_payload, task_id=cloned_task.id))

    await db.flush()
    await update_workflow_roi(rollback_workflow)
    _append_activity(rollback_workflow, "workflow.rollback_draft", f"Rollback draft created from workflow {workflow_id}.")
    await log_audit(
        db,
        action_type="CREATE",
        table_name="workflows",
        record_id=rollback_workflow.id,
        new_state={"source_workflow_id": workflow_id, "mode": "rollback-draft"},
        description=f"Created rollback draft from workflow {workflow_id}",
    )
    await db.commit()

    rollback_result = await db.execute(_workflow_query().where(Workflow.id == rollback_workflow.id))
    return rollback_result.scalar_one()

@router.post("/{workflow_id}/restore")
async def restore_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow.is_deleted = False 
    await db.commit()
    return {"message": "Workflow restored."}

@router.delete("/{workflow_id}")
async def soft_delete_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow.is_deleted = True 
    await db.commit()
    return {"message": "Workflow archived."}
