from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from ..database import get_db
from ..models.models import AutomationProject
from ..schemas.schemas import AutomationProjectCreate, AutomationProjectRead
from ..core.audit import log_audit

router = APIRouter()


@router.get("", response_model=List[AutomationProjectRead])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AutomationProject)
        .where(AutomationProject.is_deleted == False)
        .order_by(AutomationProject.updated_at.desc(), AutomationProject.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=AutomationProjectRead)
async def create_project(project_data: AutomationProjectCreate, db: AsyncSession = Depends(get_db)):
    project = AutomationProject(**project_data.model_dump())
    db.add(project)
    await db.flush()

    await log_audit(
        db,
        action_type="CREATE",
        table_name="automation_projects",
        record_id=project.id,
        new_state=project_data.model_dump(mode="json"),
        description=f"Created automation project '{project.name}'",
    )
    await db.commit()
    return project


@router.put("/{project_id}", response_model=AutomationProjectRead)
async def update_project(project_id: int, project_data: AutomationProjectCreate, db: AsyncSession = Depends(get_db)):
    project = await db.get(AutomationProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Automation project not found")

    previous_state = {c.name: getattr(project, c.name) for c in project.__table__.columns}
    for key, value in project_data.model_dump().items():
        if hasattr(project, key):
            setattr(project, key, value)

    await log_audit(
        db,
        action_type="UPDATE",
        table_name="automation_projects",
        record_id=project.id,
        previous_state=previous_state,
        new_state=project_data.model_dump(mode="json"),
        description=f"Updated automation project '{project.name}'",
    )
    await db.commit()
    return project
