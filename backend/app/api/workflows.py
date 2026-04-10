from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from ..database import get_db
from ..models.models import Workflow, Task, TaxonomyEnum
from ..schemas.schemas import WorkflowCreate, WorkflowRead, TaxonomyRead
from ..core.audit import log_audit
from ..core.metrics import update_workflow_roi
import json

router = APIRouter()

@router.post("/", response_model=WorkflowRead)
async def create_workflow(workflow_data: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    # 2.1 The Gatekeeper Logic
    if not workflow_data.repeatability_check:
        raise HTTPException(
            status_code=400, 
            detail="Workflows must be repeatable processes. One-off troubleshooting or isolated incidents should be handled via Jira."
        )
    
    # Requirement: No measurable output
    if not workflow_data.output_type or not workflow_data.output_description:
        raise HTTPException(
            status_code=400,
            detail="A workflow must produce a measurable outcome or product. Please define the final state before mapping tasks."
        )

    new_workflow = Workflow(**workflow_data.model_dump())
    db.add(new_workflow)
    await db.flush() # Get ID for audit
    
    await log_audit(
        db, 
        action_type="CREATE", 
        table_name="workflows", 
        record_id=new_workflow.id,
        new_state=workflow_data.model_dump(),
        description=f"Initiated workflow: {new_workflow.name}"
    )
    
    await db.commit()
    await db.refresh(new_workflow)
    return new_workflow

@router.get("/", response_model=List[WorkflowRead])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.is_deleted == False)
        .options(selectinload(Workflow.tasks).selectinload(Task.blockers),
                 selectinload(Workflow.tasks).selectinload(Task.errors))
        .order_by(Workflow.created_at.desc())
    )
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

@router.patch("/{workflow_id}", response_model=WorkflowRead)
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
    
    for key, value in workflow_data.items():
        if hasattr(workflow, key):
            setattr(workflow, key, value)
    
    # Recalculate ROI if frequency changed
    if "frequency" in workflow_data:
        update_workflow_roi(workflow)
        
    await log_audit(
        db,
        action_type="UPDATE",
        table_name="workflows",
        record_id=workflow.id,
        previous_state=previous_state,
        new_state=workflow_data,
        description=f"Updated workflow metadata: {workflow.name}"
    )
    
    await db.commit()
    await db.refresh(workflow)
    return workflow

@router.delete("/{workflow_id}")
async def soft_delete_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    previous_state = {"is_deleted": workflow.is_deleted}
    workflow.is_deleted = True # Soft delete
    
    await log_audit(
        db,
        action_type="DELETE",
        table_name="workflows",
        record_id=workflow.id,
        previous_state=previous_state,
        new_state={"is_deleted": True},
        description=f"Archived workflow: {workflow.name}"
    )
    
    await db.commit()
    return {"message": "Workflow successfully archived (soft deleted)."}
