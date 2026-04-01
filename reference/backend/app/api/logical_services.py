from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from typing import List, Optional
from ..database import get_db
from ..models import models

router = APIRouter(prefix="/logical-services", tags=["Logical Services"])

def filter_valid_columns(model, data):
    valid_keys = {c.name for c in model.__table__.columns}
    exclude = {"id", "created_at", "updated_at", "created_by_user_id"}
    return {k: v for k, v in data.items() if k in valid_keys and k not in exclude}

@router.get("/")
async def get_services(device_id: Optional[int] = None, include_deleted: bool = False, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    query = select(models.LogicalService).options(selectinload(models.LogicalService.secrets))
    if device_id:
        query = query.filter(models.LogicalService.device_id == device_id)
    if not include_deleted:
        query = query.filter(models.LogicalService.is_deleted == False)
    
    result = await db.execute(query)
    services = result.scalars().all()
    
    if not services:
        return []

    device_ids = {s.device_id for s in services if s.device_id}
    devices = {}
    if device_ids:
        dev_res = await db.execute(select(models.Device).filter(models.Device.id.in_(list(device_ids))))
        devices = {d.id: d for d in dev_res.scalars().all()}
    
    final_result = []
    for s in services:
        device_name = "Floating / Unmounted"
        if s.device_id:
            dev = devices.get(s.device_id)
            if dev: device_name = dev.name
            
        final_result.append({
            "id": s.id,
            "name": s.name,
            "service_type": s.service_type,
            "status": s.status,
            "version": s.version,
            "environment": s.environment,
            "device_id": s.device_id,
            "device_name": device_name,
            "config_json": s.config_json,
            "custom_attributes": s.custom_attributes,
            "is_deleted": s.is_deleted,
            "purchase_type": s.purchase_type,
            "purchase_date": s.purchase_date.isoformat() if s.purchase_date else None,
            "expiry_date": s.expiry_date.isoformat() if s.expiry_date else None,
            "installation_date": s.installation_date.isoformat() if s.installation_date else None,
            "purpose": s.purpose,
            "documentation_link": s.documentation_link,
            "vendor": s.vendor,
            "cost": s.cost,
            "currency": s.currency,
            "secrets": [{"id": sc.id, "username": sc.username, "password": sc.password, "note": sc.note} for sc in s.secrets]
        })
    return final_result

@router.post("/{service_id}/secrets")
async def add_service_secret(service_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    svc_res = await db.execute(select(models.LogicalService).filter(models.LogicalService.id == service_id))
    svc = svc_res.scalar_one_or_none()
    if not svc: raise HTTPException(404, "Service not found")
    
    secret = models.ServiceSecret(
        service_id=service_id,
        username=data.get("username"),
        password=data.get("password"),
        note=data.get("note")
    )
    db.add(secret)
    await db.commit()
    await db.refresh(secret)
    return secret

@router.delete("/{service_id}/secrets/{secret_id}")
async def delete_service_secret(service_id: int, secret_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.ServiceSecret).filter(
        models.ServiceSecret.id == secret_id,
        models.ServiceSecret.service_id == service_id
    ))
    secret = res.scalar_one_or_none()
    if not secret: raise HTTPException(404, "Secret not found")
    
    await db.delete(secret)
    await db.commit()
    return {"status": "success"}

async def sync_service_to_device(service, db: AsyncSession):
    if service.service_type == "OS" and service.device_id:
        result = await db.execute(select(models.Device).filter(models.Device.id == service.device_id))
        dev = result.scalar_one_or_none()
        if dev:
            dev.os_name = service.name
            dev.os_version = service.version
            # No internal commit here, calling code handles it

@router.post("/")
async def create_service(data: dict, db: AsyncSession = Depends(get_db)):
    # data includes: name, service_type, status, version, environment, device_id, config_json, custom_attributes
    name = data.get('name')
    if not name: raise HTTPException(400, "Service name required")

    clean_data = filter_valid_columns(models.LogicalService, data)
    
    # Handle date fields for license and installation
    for date_f in ["purchase_date", "expiry_date", "installation_date"]:
        if date_f in clean_data:
            val = clean_data[date_f]
            if not val:
                clean_data[date_f] = None
            elif isinstance(val, str):
                from datetime import datetime
                try:
                    clean_data[date_f] = datetime.fromisoformat(val.replace("Z", "+00:00"))
                except:
                    clean_data[date_f] = None

    svc = models.LogicalService(**clean_data)
    db.add(svc)
    try:
        await db.flush() # Flush to get ID without committing
        
        # Sync back to device if OS
        await sync_service_to_device(svc, db)
        
        log = models.AuditLog(
            user_id="admin", action="CREATE", target_table="logical_services", 
            target_id=str(svc.id), description=f"Registered logical service: {svc.name} ({svc.service_type})"
        )
        db.add(log)
        await db.commit()
        await db.refresh(svc)
        return svc
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{service_id}")
async def update_service(service_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.LogicalService).filter(models.LogicalService.id == service_id))
    svc = result.scalar_one_or_none()
    if not svc: raise HTTPException(404)
    
    clean_data = filter_valid_columns(models.LogicalService, data)
    for k, v in clean_data.items():
        if k in ["purchase_date", "expiry_date", "installation_date"]:
            if not v:
                setattr(svc, k, None)
            elif isinstance(v, str):
                from datetime import datetime
                try:
                    dt_val = datetime.fromisoformat(v.replace("Z", "+00:00"))
                    setattr(svc, k, dt_val)
                except:
                    setattr(svc, k, None)
            else:
                setattr(svc, k, v)
        else:
            setattr(svc, k, v)
    
    # Sync back to device if OS
    await sync_service_to_device(svc, db)
        
    log = models.AuditLog(
        user_id="admin", action="UPDATE", target_table="logical_services", 
        target_id=str(service_id), description=f"Updated service configuration: {svc.name}"
    )
    db.add(log)
    await db.commit()
    await db.refresh(svc)
    return svc

@router.delete("/{service_id}")
async def delete_service(service_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.LogicalService).filter(models.LogicalService.id == service_id))
    svc = result.scalar_one_or_none()
    if not svc: raise HTTPException(404)
    
    name = svc.name
    svc.is_deleted = True
    log = models.AuditLog(
        user_id="admin", action="DELETE", target_table="logical_services", 
        target_id=str(service_id), description=f"Soft-deleted service: {name}"
    )
    db.add(log)
    await db.commit()
    return {"status": "success"}

@router.post("/bulk-action")
async def bulk_action(data: dict, db: AsyncSession = Depends(get_db)):
    ids = data.get("ids", [])
    action = data.get("action")
    payload = data.get("payload", {})
    if not ids: return {"status": "no_op"}
    
    if action == "delete":
        await db.execute(update(models.LogicalService).where(models.LogicalService.id.in_(ids)).values(is_deleted=True))
    elif action == "restore":
        await db.execute(update(models.LogicalService).where(models.LogicalService.id.in_(ids)).values(is_deleted=False))
    elif action == "update":
        # Filter valid columns for LogicalService
        valid_keys = {c.name for c in models.LogicalService.__table__.columns}
        clean_update = {k: v for k, v in payload.items() if k in valid_keys}
        if clean_update:
            await db.execute(update(models.LogicalService).where(models.LogicalService.id.in_(ids)).values(**clean_update))
    
    await db.commit()
    return {"status": "success"}

@router.post("/{service_id}/mount/{device_id}")
async def mount_service(service_id: int, device_id: int, db: AsyncSession = Depends(get_db)):
    svc_res = await db.execute(select(models.LogicalService).filter(models.LogicalService.id == service_id))
    svc = svc_res.scalar_one_or_none()
    dev_res = await db.execute(select(models.Device).filter(models.Device.id == device_id))
    dev = dev_res.scalar_one_or_none()
    
    if not svc or not dev: raise HTTPException(404, "Service or Device not found")
    
    svc.device_id = device_id
    log = models.AuditLog(
        user_id="admin", action="MOUNT", target_table="logical_services", 
        target_id=str(service_id), description=f"Mounted service {svc.name} onto host {dev.name}"
    )
    db.add(log)
    await db.commit()
    return {"status": "success"}
