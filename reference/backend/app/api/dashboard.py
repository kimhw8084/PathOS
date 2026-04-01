from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..database import get_db
from ..models import models

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/metrics")
async def get_metrics(db: AsyncSession = Depends(get_db)):
    # Infrastructure Core
    sites_res = await db.execute(select(func.count(models.Site.id)))
    sites = sites_res.scalar()
    
    racks_res = await db.execute(select(func.count(models.Rack.id)).filter(models.Rack.is_deleted == False))
    racks = racks_res.scalar()
    
    # Application Layer Breakdown
    services_res = await db.execute(select(models.LogicalService).filter(models.LogicalService.is_deleted == False))
    services = services_res.scalars().all()
    
    service_type_counts = {}
    for s in services:
        stype = s.service_type if s.service_type else "Other"
        service_type_counts[stype] = service_type_counts.get(stype, 0) + 1

    # Asset Inventory Breakdown
    devices_res = await db.execute(select(models.Device).filter(models.Device.is_deleted == False))
    devices = devices_res.scalars().all()
    
    asset_type_counts = {}
    for d in devices:
        dtype = d.type if d.type else "Unknown"
        asset_type_counts[dtype] = asset_type_counts.get(dtype, 0) + 1
        
    # Network Fabric Breakdown
    conn_res = await db.execute(select(models.PortConnection))
    connections = conn_res.scalars().all()
    
    network_counts = {}
    for c in connections:
        purpose = c.purpose if c.purpose else "Data"
        network_counts[purpose] = network_counts.get(purpose, 0) + 1
            
    return {
        "sites": sites,
        "racks": racks,
        "total_services": len(services),
        "service_types": service_type_counts,
        "asset_types": asset_type_counts,
        "network_fabric": network_counts,
        "total_connections": len(connections)
    }
