from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from ..database import get_db
from ..models import models
from datetime import datetime

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

@router.get("/")
async def get_maintenance_windows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.MaintenanceWindow))
    windows = result.scalars().all()
    
    final = []
    for w in windows:
        dev_res = await db.execute(select(models.Device).filter(models.Device.id == w.device_id))
        dev = dev_res.scalar_one_or_none()
        final.append({
            "id": w.id,
            "device_id": w.device_id,
            "device_name": dev.name if dev else "Unknown",
            "title": w.title,
            "start_time": w.start_time,
            "end_time": w.end_time,
            "ticket_number": w.ticket_number,
            "coordinator": w.coordinator,
            "status": w.status
        })
    return final

@router.post("/")
async def create_maintenance_window(data: dict, db: AsyncSession = Depends(get_db)):
    # Parse dates
    start = datetime.fromisoformat(data['start_time'].replace("Z", "+00:00")) if data.get('start_time') else None
    end = datetime.fromisoformat(data['end_time'].replace("Z", "+00:00")) if data.get('end_time') else None
    
    mw = models.MaintenanceWindow(
        device_id=data.get('device_id'),
        title=data.get('title'),
        start_time=start,
        end_time=end,
        ticket_number=data.get('ticket_number'),
        coordinator=data.get('coordinator'),
        status=data.get('status', 'Scheduled')
    )
    db.add(mw)
    await db.commit()
    await db.refresh(mw)
    
    log = models.AuditLog(user_id="admin", action="CREATE", target_table="maintenance_windows", target_id=str(mw.id), description=f"Scheduled maintenance: {mw.title}")
    db.add(log)
    await db.commit()
    return mw

@router.delete("/{mw_id}")
async def delete_maintenance_window(mw_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.MaintenanceWindow).filter(models.MaintenanceWindow.id == mw_id))
    mw = result.scalar_one_or_none()
    if mw:
        db.delete(mw)
        log = models.AuditLog(user_id="admin", action="DELETE", target_table="maintenance_windows", target_id=str(mw_id), description=f"Cancelled maintenance: {mw.title}")
        db.add(log)
        await db.commit()
    return {"status": "success"}
