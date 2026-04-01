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

@router.put("/workflow/{workflow_id}/sync", response_model=List[TaskRead])
async def sync_tasks(workflow_id: int, tasks_data: List[TaskCreate], db: AsyncSession = Depends(get_db)):
    # Verify workflow exists
    wf_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = wf_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Delete existing tasks for this workflow (Hard delete for sync consistency)
    from sqlalchemy import delete
    await db.execute(delete(Task).where(Task.workflow_id == workflow_id))
    
    # Create new tasks
    new_tasks = []
    for t_data in tasks_data:
        new_task = Task(**t_data.model_dump())
        new_task.workflow_id = workflow_id
        db.add(new_task)
        new_tasks.append(new_task)
    
    await db.commit()
    
    # Update ROI after sync
    await update_workflow_roi(workflow, db)
    await db.commit()
    
    return new_tasks
