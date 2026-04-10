from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from ..database import get_db
from ..models.models import Task, Workflow, Blocker, TaskError
from ..schemas.schemas import TaskCreate, TaskRead
from ..core.metrics import update_workflow_roi
from ..core.audit import log_audit

router = APIRouter()

@router.post("", response_model=TaskRead)
async def create_task(task_data: TaskCreate, db: AsyncSession = Depends(get_db)):
    # Verify workflow exists
    wf_result = await db.execute(
        select(Workflow)
        .where(Workflow.id == task_data.workflow_id)
        .options(selectinload(Workflow.tasks))
    )
    workflow = wf_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Create task (excluding nested lists)
    task_dict = task_data.model_dump()
    blockers_data = task_dict.pop("blockers", [])
    errors_data = task_dict.pop("errors", [])
    
    new_task = Task(**task_dict)
    db.add(new_task)
    await db.flush()
    
    # Add blockers
    for b_data in blockers_data:
        blocker = Blocker(**b_data, task_id=new_task.id)
        db.add(blocker)
        
    # Add errors
    for e_data in errors_data:
        error = TaskError(**e_data, task_id=new_task.id)
        db.add(error)
    
    await log_audit(
        db,
        action_type="CREATE",
        table_name="tasks",
        record_id=new_task.id,
        new_state=task_data.model_dump(),
        description=f"Added task '{new_task.name}' with {len(blockers_data)} blockers and {len(errors_data)} errors to workflow '{workflow.name}'"
    )
    
    # Expire to force reload of tasks relationship
    db.expire(workflow)
    
    # Reload workflow with all tasks, blockers, and errors for ROI calc
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow.id)
        .options(selectinload(Workflow.tasks).selectinload(Task.blockers), 
                 selectinload(Workflow.tasks).selectinload(Task.errors))
    )
    workflow = result.scalar_one()

    await update_workflow_roi(workflow)
    await db.commit()

    
    # Return task with blockers and errors
    task_result = await db.execute(
        select(Task)
        .where(Task.id == new_task.id)
        .options(selectinload(Task.blockers), selectinload(Task.errors))
    )
    return task_result.scalar_one()

@router.put("/workflow/{workflow_id}/sync", response_model=List[TaskRead])
async def sync_tasks(workflow_id: int, tasks_data: List[TaskCreate], db: AsyncSession = Depends(get_db)):
    # Verify workflow exists
    wf_result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.tasks).selectinload(Task.blockers),
                 selectinload(Workflow.tasks).selectinload(Task.errors))
    )
    workflow = wf_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Capture previous state for audit
    previous_tasks = []
    for t in workflow.tasks:
        t_dict = {c.name: getattr(t, c.name) for c in t.__table__.columns}
        t_dict["blockers"] = [{bc.name: getattr(b, bc.name) for bc in b.__table__.columns} for b in t.blockers]
        t_dict["errors"] = [{ec.name: getattr(e, ec.name) for ec in e.__table__.columns} for e in t.errors]
        previous_tasks.append(t_dict)
    
    # Delete existing tasks for this workflow (Cascades to blockers and errors)
    from sqlalchemy import delete
    await db.execute(delete(Task).where(Task.workflow_id == workflow_id))
    
    # Create new tasks, blockers, and errors
    for t_data in tasks_data:
        t_dict = t_data.model_dump()
        blockers_data = t_dict.pop("blockers", [])
        errors_data = t_dict.pop("errors", [])
        
        new_task = Task(**t_dict)
        new_task.workflow_id = workflow_id
        db.add(new_task)
        await db.flush() # Get task ID
        
        for b_data in blockers_data:
            blocker = Blocker(**b_data, task_id=new_task.id)
            db.add(blocker)
            
        for e_data in errors_data:
            error = TaskError(**e_data, task_id=new_task.id)
            db.add(error)
    
    await db.flush()
    
    await log_audit(
        db,
        action_type="UPDATE",
        table_name="workflows",
        record_id=workflow_id,
        previous_state={"tasks": previous_tasks},
        new_state={"tasks": [t.model_dump() for t in tasks_data]},
        description=f"Synchronized task sequence with blockers and errors for workflow '{workflow.name}'"
    )
    
    # Expire to force reload of tasks relationship
    db.expire(workflow)
    
    # Reload workflow with new tasks to update ROI
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.tasks).selectinload(Task.blockers),
                 selectinload(Workflow.tasks).selectinload(Task.errors))
    )
    workflow = result.scalar_one()

    await update_workflow_roi(workflow)
    await db.commit()

    
    # Return newly created tasks with nested relationships
    result_tasks = await db.execute(
        select(Task)
        .where(Task.workflow_id == workflow_id)
        .options(selectinload(Task.blockers), selectinload(Task.errors))
    )
    return result_tasks.scalars().all()
