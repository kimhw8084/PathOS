from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from typing import List, Optional, Any, Dict
from ..database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(prefix="/intelligence", tags=["External Intelligence"])

def filter_valid_columns(model, data):
    valid_keys = {c.name for c in model.__table__.columns}
    exclude = {"id", "created_at", "updated_at", "created_by_user_id"}
    return {k: v for k, v in data.items() if k in valid_keys and k not in exclude}

async def log_audit(db: AsyncSession, action: str, table: str, target_id: int, description: str, changes: Optional[Dict] = None):
    log = models.AuditLog(
        user_id="admin", # Default for prototype
        action=action,
        target_table=table,
        target_id=str(target_id),
        description=description,
        changes=changes
    )
    db.add(log)
    await db.commit()

# --- External Entities ---

@router.get("/entities", response_model=List[schemas.ExternalEntityResponse])
async def get_entities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ExternalEntity))
    return result.scalars().all()

@router.post("/entities", response_model=schemas.ExternalEntityResponse)
async def create_entity(data: schemas.ExternalEntityCreate, db: AsyncSession = Depends(get_db)):
    db_obj = models.ExternalEntity(**data.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    await log_audit(db, "CREATE", "external_entities", db_obj.id, f"Created external entity: {db_obj.name}")
    return db_obj

@router.put("/entities/{entity_id}", response_model=schemas.ExternalEntityResponse)
async def update_entity(entity_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ExternalEntity).filter(models.ExternalEntity.id == entity_id))
    obj = result.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Entity not found")
    
    clean_data = filter_valid_columns(models.ExternalEntity, data)
    for k, v in clean_data.items():
        setattr(obj, k, v)
    
    await db.commit()
    await db.refresh(obj)
    await log_audit(db, "UPDATE", "external_entities", entity_id, f"Updated external entity: {obj.name}", clean_data)
    return obj

@router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ExternalEntity).filter(models.ExternalEntity.id == entity_id))
    obj = result.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Entity not found")
    
    # Check for links
    link_check = await db.execute(select(models.ExternalLink).filter(models.ExternalLink.external_entity_id == entity_id))
    if link_check.scalars().first():
        raise HTTPException(400, "Cannot delete entity with active connectivity links")

    await db.delete(obj)
    await db.commit()
    await log_audit(db, "DELETE", "external_entities", entity_id, f"Deleted external entity: {obj.name}")
    return {"status": "success"}

# --- External Links ---

@router.get("/links", response_model=List[schemas.ExternalLinkResponse])
async def get_links(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ExternalLink))
    items = result.scalars().all()
    
    res = []
    for item in items:
        resp = schemas.ExternalLinkResponse.model_validate(item)
        
        # Enrich names
        ent_res = await db.execute(select(models.ExternalEntity.name).filter(models.ExternalEntity.id == item.external_entity_id))
        resp.external_entity_name = ent_res.scalar_one_or_none()
        
        dev_res = await db.execute(select(models.Device.name).filter(models.Device.id == item.device_id))
        resp.device_name = dev_res.scalar_one_or_none()
        
        if item.service_id:
            svc_res = await db.execute(select(models.LogicalService.name).filter(models.LogicalService.id == item.service_id))
            resp.service_name = svc_res.scalar_one_or_none()
            
        res.append(resp)
    return res

@router.post("/links", response_model=schemas.ExternalLinkResponse)
async def create_link(data: schemas.ExternalLinkCreate, db: AsyncSession = Depends(get_db)):
    db_obj = models.ExternalLink(**data.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    await log_audit(db, "CREATE", "external_links", db_obj.id, f"Established external link to {db_obj.purpose}")
    return db_obj

@router.delete("/links/{link_id}")
async def delete_link(link_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ExternalLink).filter(models.ExternalLink.id == link_id))
    obj = result.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Link not found")
    
    await db.delete(obj)
    await db.commit()
    await log_audit(db, "DELETE", "external_links", link_id, "Severed external link")
    return {"status": "success"}
