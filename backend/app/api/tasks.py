from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.models import Task, Workflow
from ..schemas.schemas import TaskCreate, TaskRead
from ..core.metrics import update_workflow_roi

router = APIRouter()

@router.post("/", response_model=TaskRead)
async def create_task(task_data: TaskCreate, db: AsyncSession = Depends(get_db)):
    # Verify workflow exists
    wf_result = await db.execute(select(Workflow).where(Workflow.id == task_data.workflow_id))
    workflow = wf_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    new_task = Task(**task_data.model_dump())
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    
    # Update ROI
    await update_workflow_roi(workflow)
    await db.commit()
    
    return new_task

@router.get("/workflow/{workflow_id}", response_model=List[TaskRead])
async def list_tasks(workflow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Task)
        .where(Task.workflow_id == workflow_id)
        .where(Task.is_deleted == False)
        .order_by(Task.order_index)
    )
    return result.scalars().all()
