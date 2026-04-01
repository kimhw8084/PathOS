from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from ..database import get_db
from ..models.models import Workflow, Task, TaxonomyEnum
from ..schemas.schemas import WorkflowCreate, WorkflowRead, TaxonomyRead

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
    await db.commit()
    await db.refresh(new_workflow)
    return new_workflow

@router.get("/", response_model=List[WorkflowRead])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.is_deleted == False)
        .options(selectinload(Workflow.tasks))
        .order_by(Workflow.created_at.desc())
    )
    return result.scalars().all()

@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.tasks))
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.delete("/{workflow_id}")
async def soft_delete_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow.is_deleted = True # Soft delete
    await db.commit()
    return {"message": "Workflow successfully archived (soft deleted)."}
