from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, attributes
from typing import List, Optional
from ..database import get_db
from ..models.models import Workflow, Task, TaxonomyEnum, Blocker, TaskError
from ..schemas.schemas import WorkflowCreate, WorkflowRead, TaxonomyRead
from ..core.audit import log_audit
from ..core.metrics import update_workflow_roi
from ..core.workflow_analysis import serialize_workflow_snapshot
import json

router = APIRouter()


def _workflow_query():
    return select(Workflow).options(
        selectinload(Workflow.tasks).selectinload(Task.blockers),
        selectinload(Workflow.tasks).selectinload(Task.errors)
    )


def _clone_task_payload(task: Task) -> dict:
    payload = {
        c.name: getattr(task, c.name)
        for c in task.__table__.columns
        if c.name not in {"id", "workflow_id", "created_at", "updated_at"}
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

    new_workflow = Workflow(**workflow_dict)
    db.add(new_workflow)
    await db.flush()
    
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
    
    previous_state = {c.name: getattr(workflow, c.name) for c in workflow.__table__.columns}
    
    # Extract tasks if provided
    tasks_data = workflow_data.get("tasks")
    
    # Update workflow fields
    data_to_update = {k: v for k, v in workflow_data.items() if k != "tasks"}
    
    # Handle list to string conversion for tool_family and tool_id
    if "tool_family" in data_to_update and isinstance(data_to_update["tool_family"], list):
        data_to_update["tool_family"] = ", ".join(data_to_update["tool_family"])
    
    if "applicable_tools" in data_to_update:
        val = data_to_update.pop("applicable_tools")
        if isinstance(val, list):
            data_to_update["tool_id"] = ", ".join(val)
        else:
            data_to_update["tool_id"] = val

    print(f"DEBUG: Updating workflow {workflow_id}. edges in data: {data_to_update.get('edges')}")
    
    for key, value in data_to_update.items():
        if hasattr(workflow, key):
            setattr(workflow, key, value)
            if isinstance(value, (list, dict)):
                attributes.flag_modified(workflow, key)
    
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
    print(f"DEBUG: Workflow reloaded. edges: {workflow.edges}")

    # Recalculate ROI on the reloaded state
    await update_workflow_roi(workflow)
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
    
    await db.commit()
    
    # Reload for final return to ensure everything is hydrated
    result = await db.execute(_workflow_query().where(Workflow.id == workflow_id))
    return result.scalar_one()


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
        }
    )

    cloned_workflow = Workflow(**clone_payload)
    db.add(cloned_workflow)
    await db.flush()

    for index, task in enumerate(source_workflow.tasks):
        task_payload = _clone_task_payload(task)
        blockers = task_payload.pop("blockers", [])
        errors = task_payload.pop("errors", [])
        cloned_task = Task(**task_payload, workflow_id=cloned_workflow.id, order_index=index)
        db.add(cloned_task)
        await db.flush()
        for blocker_payload in blockers:
            db.add(Blocker(**blocker_payload, task_id=cloned_task.id))
        for error_payload in errors:
            db.add(TaskError(**error_payload, task_id=cloned_task.id))

    await db.flush()
    await update_workflow_roi(cloned_workflow)
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
