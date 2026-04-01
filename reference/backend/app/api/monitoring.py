from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from typing import List, Optional
from ..database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(prefix="/monitoring", tags=["Monitoring Matrix"])

def filter_valid_columns(model, data):
    valid_keys = {c.name for c in model.__table__.columns}
    exclude = {"id", "created_at", "updated_at", "created_by_user_id"}
    return {k: v for k, v in data.items() if k in valid_keys and k not in exclude}

@router.get("/", response_model=List[schemas.MonitoringItemResponse])
async def get_monitoring_items(device_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    query = select(models.MonitoringItem)
    if device_id:
        query = query.filter(models.MonitoringItem.device_id == device_id)
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    # Enrich with device name and service names
    res = []
    for item in items:
        resp = schemas.MonitoringItemResponse.model_validate(item)
        if item.device_id:
            dev_res = await db.execute(select(models.Device.name).filter(models.Device.id == item.device_id))
            resp.device_name = dev_res.scalar_one_or_none()
            
        if item.monitored_services:
            svc_res = await db.execute(select(models.LogicalService.name).filter(models.LogicalService.id.in_(item.monitored_services)))
            resp.monitored_service_names = list(svc_res.scalars().all())
            
        res.append(resp)
        
    return res

@router.post("/", response_model=schemas.MonitoringItemResponse)
async def create_monitoring_item(data: schemas.MonitoringItemCreate, db: AsyncSession = Depends(get_db)):
    db_obj = models.MonitoringItem(**data.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    
    resp = schemas.MonitoringItemResponse.model_validate(db_obj)
    if db_obj.device_id:
        dev_res = await db.execute(select(models.Device.name).filter(models.Device.id == db_obj.device_id))
        resp.device_name = dev_res.scalar_one_or_none()
        
    if db_obj.monitored_services:
        svc_res = await db.execute(select(models.LogicalService.name).filter(models.LogicalService.id.in_(db_obj.monitored_services)))
        resp.monitored_service_names = list(svc_res.scalars().all())
        
    return resp

@router.put("/{item_id}", response_model=schemas.MonitoringItemResponse)
async def update_monitoring_item(item_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.MonitoringItem).filter(models.MonitoringItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item: raise HTTPException(404, "Monitoring item not found")
    
    clean_data = filter_valid_columns(models.MonitoringItem, data)
    for k, v in clean_data.items():
        setattr(item, k, v)
        
    await db.commit()
    await db.refresh(item)
    
    resp = schemas.MonitoringItemResponse.model_validate(item)
    if item.device_id:
        dev_res = await db.execute(select(models.Device.name).filter(models.Device.id == item.device_id))
        resp.device_name = dev_res.scalar_one_or_none()
        
    if item.monitored_services:
        svc_res = await db.execute(select(models.LogicalService.name).filter(models.LogicalService.id.in_(item.monitored_services)))
        resp.monitored_service_names = list(svc_res.scalars().all())
        
    return resp

@router.delete("/{item_id}")
async def delete_monitoring_item(item_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.MonitoringItem).filter(models.MonitoringItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item: raise HTTPException(404, "Monitoring item not found")
    
    await db.delete(item)
    await db.commit()
    return {"status": "success"}
