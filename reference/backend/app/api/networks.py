from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, or_, and_
from typing import List
from ..database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(prefix="/networks", tags=["Network Fabric"])

def filter_valid_columns(model, data):
    valid_keys = {c.name for c in model.__table__.columns}
    exclude = {"id", "created_at", "updated_at", "created_by_user_id"}
    return {k: v for k, v in data.items() if k in valid_keys and k not in exclude}

@router.get("/interfaces")
async def get_interfaces(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.NetworkInterface))
    interfaces = result.scalars().all()
    return [{"id": i.id, "name": i.name, "mac_address": i.mac_address, "ip_address": i.ip_address, "link_speed_gbps": i.link_speed_gbps} for i in interfaces]

@router.post("/interfaces")
async def create_interface(data: dict, db: AsyncSession = Depends(get_db)):
    clean_data = filter_valid_columns(models.NetworkInterface, data)
    if 'id' in clean_data and not clean_data['id']:
        del clean_data['id']
    db_obj = models.NetworkInterface(**clean_data)
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return {"status": "success", "id": db_obj.id}

@router.put("/interfaces/{interface_id}")
async def update_interface(interface_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.NetworkInterface).filter(models.NetworkInterface.id == interface_id))
    item = res.scalar_one_or_none()
    if not item: raise HTTPException(404)
    
    clean = filter_valid_columns(models.NetworkInterface, data)
    for k, v in clean.items():
        if k != "id": setattr(item, k, v)
    
    await db.commit()
    await db.refresh(item)
    return item

@router.get("/connections")
async def get_connections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.PortConnection))
    conns = result.scalars().all()
    
    final_result = []
    for c in conns:
        dev_a_res = await db.execute(select(models.Device).filter(models.Device.id == c.source_device_id))
        dev_a = dev_a_res.scalar_one_or_none()
        dev_b_res = await db.execute(select(models.Device).filter(models.Device.id == c.target_device_id))
        dev_b = dev_b_res.scalar_one_or_none()
        
        final_result.append({
            "id": c.id,
            "source_device_id": c.source_device_id,
            "server_a": dev_a.name if dev_a else "Unknown",
            "source_port": c.source_port,
            "port_a": c.source_port,
            "source_ip": c.source_ip,
            "source_mac": c.source_mac,
            "source_vlan": c.source_vlan,
            "target_device_id": c.target_device_id,
            "server_b": dev_b.name if dev_b else "Unknown",
            "target_port": c.target_port,
            "port_b": c.target_port,
            "target_ip": c.target_ip,
            "target_mac": c.target_mac,
            "target_vlan": c.target_vlan,
            "speed": f"{c.speed_gbps} {c.unit}" if c.speed_gbps else "Unknown",
            "speed_gbps": c.speed_gbps,
            "unit": c.unit,
            "link_type": c.link_type,
            "purpose": c.purpose,
            "direction": c.direction,
            "cable_type": c.cable_type
        })
    return final_result

@router.post("/connections")
async def create_connection(data: dict, db: AsyncSession = Depends(get_db)):
    source_device_id = data.get('device_a_id')
    source_port = data.get('source_port') or data.get('port_a')
    target_device_id = data.get('device_b_id')
    target_port = data.get('target_port') or data.get('port_b')

    if not all([source_device_id, source_port, target_device_id, target_port]):
        raise HTTPException(400, "Incomplete mapping data")

    # Duplicate check: port on a device can only have one physical connection
    dup_query = select(models.PortConnection).filter(
        or_(
            and_(models.PortConnection.source_device_id == source_device_id, models.PortConnection.source_port == source_port),
            and_(models.PortConnection.target_device_id == source_device_id, models.PortConnection.target_port == source_port),
            and_(models.PortConnection.source_device_id == target_device_id, models.PortConnection.source_port == target_port),
            and_(models.PortConnection.target_device_id == target_device_id, models.PortConnection.target_port == target_port)
        )
    )
    dup_res = await db.execute(dup_query)
    if dup_res.scalars().first():
        raise HTTPException(400, "One of the selected ports is already physically cross-connected")

    conn = models.PortConnection(
        source_device_id=source_device_id,
        source_port=source_port,
        source_ip=data.get('source_ip'),
        source_mac=data.get('source_mac'),
        source_vlan=data.get('source_vlan'),
        target_device_id=target_device_id,
        target_port=target_port,
        target_ip=data.get('target_ip'),
        target_mac=data.get('target_mac'),
        target_vlan=data.get('target_vlan'),
        link_type=data.get('link_type'), 
        purpose=data.get('purpose'),
        speed_gbps=data.get('speed_gbps'),
        unit=data.get('unit', 'Gbps'),
        direction=data.get('direction'),
        cable_type=data.get('cable_type')
    )
    db.add(conn)
    log = models.AuditLog(user_id="admin", action="CREATE", target_table="port_connections", description=f"Established link between dev {source_device_id} and {target_device_id}")
    db.add(log)
    await db.commit()
    await db.refresh(conn)
    return conn

@router.put("/connections/{conn_id}")
async def update_connection(conn_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.PortConnection).filter(models.PortConnection.id == conn_id))
    conn = result.scalar_one_or_none()
    if not conn: raise HTTPException(404)
    
    if 'device_a_id' in data: conn.source_device_id = data['device_a_id']
    if 'port_a' in data: conn.source_port = data['port_a']
    if 'source_ip' in data: conn.source_ip = data['source_ip']
    if 'source_mac' in data: conn.source_mac = data['source_mac']
    if 'source_vlan' in data: conn.source_vlan = data['source_vlan']
    if 'device_b_id' in data: conn.target_device_id = data['device_b_id']
    if 'port_b' in data: conn.target_port = data['port_b']
    if 'target_ip' in data: conn.target_ip = data['target_ip']
    if 'target_mac' in data: conn.target_mac = data['target_mac']
    if 'target_vlan' in data: conn.target_vlan = data['target_vlan']
    if 'link_type' in data: conn.link_type = data['link_type']
    if 'purpose' in data: conn.purpose = data['purpose']
    if 'speed_gbps' in data: conn.speed_gbps = data['speed_gbps']
    if 'direction' in data: conn.direction = data['direction']
    if 'cable_type' in data: conn.cable_type = data['cable_type']

    log = models.AuditLog(
        user_id="admin", action="UPDATE", target_table="port_connections", target_id=str(conn_id), description="Modified network link"
    )
    db.add(log)
    await db.commit()
    return conn

@router.delete("/connections/{conn_id}")
async def delete_connection(conn_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.PortConnection).filter(models.PortConnection.id == conn_id))
    conn = result.scalar_one_or_none()
    if not conn: raise HTTPException(status_code=404, detail="Connection not found")
    
    await db.delete(conn)
    log = models.AuditLog(user_id="admin", action="DELETE", target_table="port_connections", target_id=str(conn_id), description="Severed network link")
    db.add(log)
    await db.commit()
    return {"status": "success"}
