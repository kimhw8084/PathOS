from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from ..database import get_db
from ..models.models import Workflow, WorkflowExecution
from ..schemas.schemas import WorkflowExecutionCreate, WorkflowExecutionRead
from ..core.audit import log_audit

router = APIRouter()


def _execution_query():
    return select(WorkflowExecution).options(selectinload(WorkflowExecution.workflow))


@router.get("", response_model=List[WorkflowExecutionRead])
async def list_executions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(_execution_query().where(WorkflowExecution.is_deleted == False).order_by(WorkflowExecution.execution_started_at.desc()))
    return result.scalars().all()


@router.post("", response_model=WorkflowExecutionRead)
async def create_execution(execution_data: WorkflowExecutionCreate, db: AsyncSession = Depends(get_db)):
    workflow = await db.get(Workflow, execution_data.workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    execution = WorkflowExecution(**execution_data.model_dump())
    db.add(execution)
    await db.flush()

    await log_audit(
        db,
        action_type="CREATE",
        table_name="workflow_executions",
        record_id=execution.id,
        new_state=execution_data.model_dump(mode="json"),
        description=f"Logged workflow execution for '{workflow.name}'",
    )
    await db.commit()

    result = await db.execute(_execution_query().where(WorkflowExecution.id == execution.id))
    return result.scalar_one()


@router.put("/{execution_id}", response_model=WorkflowExecutionRead)
async def update_execution(execution_id: int, execution_data: WorkflowExecutionCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(_execution_query().where(WorkflowExecution.id == execution_id))
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    workflow = await db.get(Workflow, execution_data.workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    previous_state = {c.name: getattr(execution, c.name) for c in execution.__table__.columns}
    for key, value in execution_data.model_dump().items():
        if hasattr(execution, key):
            setattr(execution, key, value)

    await log_audit(
        db,
        action_type="UPDATE",
        table_name="workflow_executions",
        record_id=execution.id,
        previous_state=previous_state,
        new_state=execution_data.model_dump(mode="json"),
        description=f"Updated workflow execution {execution.id}",
    )
    await db.commit()

    result = await db.execute(_execution_query().where(WorkflowExecution.id == execution.id))
    return result.scalar_one()
