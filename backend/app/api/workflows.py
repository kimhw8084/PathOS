from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, attributes
from typing import List, Optional
from ..database import get_db
from ..models.models import Workflow, Task, TaxonomyEnum
from ..schemas.schemas import WorkflowCreate, WorkflowRead, TaxonomyRead
from ..core.audit import log_audit
from ..core.metrics import update_workflow_roi
import json

router = APIRouter()

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

    new_workflow = Workflow(**workflow_data.model_dump())
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
    
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == new_workflow.id)
        .options(selectinload(Workflow.tasks).selectinload(Task.blockers),
                 selectinload(Workflow.tasks).selectinload(Task.errors))
    )
    return result.scalar_one()

@router.get("", response_model=List[WorkflowRead])
async def list_workflows(include_deleted: bool = False, db: AsyncSession = Depends(get_db)):
    query = select(Workflow).options(
        selectinload(Workflow.tasks).selectinload(Task.blockers),
        selectinload(Workflow.tasks).selectinload(Task.errors)
    ).order_by(Workflow.created_at.desc())
    
    if not include_deleted:
        query = query.where(Workflow.is_deleted == False)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.tasks).selectinload(Task.blockers),
                 selectinload(Workflow.tasks).selectinload(Task.errors))
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.put("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(workflow_id: int, workflow_data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.tasks).selectinload(Task.blockers),
                 selectinload(Workflow.tasks).selectinload(Task.errors))
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    previous_state = {c.name: getattr(workflow, c.name) for c in workflow.__table__.columns}
    
    # Extract tasks if provided
    tasks_data = workflow_data.get("tasks")
    
    # Update workflow fields
    data_to_update = {k: v for k, v in workflow_data.items() if k != "tasks"}
    
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
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.tasks).selectinload(Task.blockers),
                 selectinload(Workflow.tasks).selectinload(Task.errors))
    )
    workflow = result.scalar_one()
    print(f"DEBUG: Workflow reloaded. edges: {workflow.edges}")

    # Recalculate ROI on the reloaded state
    await update_workflow_roi(workflow)
        
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
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.tasks).selectinload(Task.blockers),
                 selectinload(Workflow.tasks).selectinload(Task.errors))
    )
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
