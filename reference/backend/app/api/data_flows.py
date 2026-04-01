from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from typing import List
from ..database import get_db
from ..models import models

router = APIRouter(prefix="/data-flows", tags=["Data Flow Designer"])

def format_flow(flow: models.DataFlow):
    return {
        "id": flow.id,
        "name": flow.name,
        "description": flow.description,
        "category": flow.category,
        "nodes": flow.nodes_json,
        "edges": flow.edges_json,
        "viewport": flow.viewport_json,
        "is_template": flow.is_template,
        "is_deleted": flow.is_deleted,
        "created_at": flow.created_at.isoformat() if flow.created_at else None,
        "updated_at": flow.updated_at.isoformat() if flow.updated_at else None
    }

@router.get("/")
async def get_flows(include_deleted: bool = False, db: AsyncSession = Depends(get_db)):
    query = select(models.DataFlow)
    if not include_deleted:
        query = query.filter(models.DataFlow.is_deleted == False)
    else:
        query = query.filter(models.DataFlow.is_deleted == True)
        
    result = await db.execute(query.order_by(models.DataFlow.updated_at.desc()))
    flows = result.scalars().all()
    return [format_flow(f) for f in flows]

@router.post("/")
async def create_flow(data: dict, db: AsyncSession = Depends(get_db)):
    flow = models.DataFlow(
        name=data.get("name", "New Data Flow"),
        description=data.get("description", ""),
        category=data.get("category", "System"),
        nodes_json=data.get("nodes", []),
        edges_json=data.get("edges", []),
        viewport_json=data.get("viewport", {}),
        is_template=data.get("is_template", False)
    )
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return format_flow(flow)

@router.get("/{flow_id}")
async def get_flow(flow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.DataFlow).filter(models.DataFlow.id == flow_id))
    flow = result.scalar_one_or_none()
    if not flow: raise HTTPException(404, "Flow not found")
    return format_flow(flow)

@router.put("/{flow_id}")
async def update_flow(flow_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.DataFlow).filter(models.DataFlow.id == flow_id))
    flow = result.scalar_one_or_none()
    if not flow: raise HTTPException(404, "Flow not found")
    
    if "name" in data: flow.name = data["name"]
    if "description" in data: flow.description = data["description"]
    if "category" in data: flow.category = data["category"]
    if "nodes" in data: flow.nodes_json = data["nodes"]
    if "edges" in data: flow.edges_json = data["edges"]
    if "viewport" in data: flow.viewport_json = data["viewport"]
    if "is_deleted" in data: flow.is_deleted = data["is_deleted"]
    
    await db.commit()
    return format_flow(flow)

@router.post("/{flow_id}/restore")
async def restore_flow(flow_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.DataFlow).filter(models.DataFlow.id == flow_id))
    flow = result.scalar_one_or_none()
    if not flow: raise HTTPException(404, "Flow not found")
    
    flow.is_deleted = False
    await db.commit()
    return format_flow(flow)

@router.delete("/{flow_id}")
async def delete_flow(flow_id: int, permanent: bool = False, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.DataFlow).filter(models.DataFlow.id == flow_id))
    flow = result.scalar_one_or_none()
    if not flow: raise HTTPException(404, "Flow not found")
    
    if permanent:
        await db.delete(flow)
    else:
        flow.is_deleted = True
        
    await db.commit()
    return {"status": "success"}
