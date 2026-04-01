from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, or_
from datetime import datetime
from ..database import get_db
from ..models import models

router = APIRouter(prefix="/devices", tags=["Devices"])

def parse_iso_date(val):
    if not val: return None
    if isinstance(val, datetime): return val
    try: return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except: return None

def filter_valid_columns(model, data):
    valid_keys = {c.name for c in model.__table__.columns}
    exclude = {"id", "created_at", "updated_at", "created_by_user_id"}
    return {k: v for k, v in data.items() if k in valid_keys and k not in exclude}

async def sync_device_to_os(device, db: AsyncSession):
    if device.os_name:
        # Check if OS service already exists for this device
        result = await db.execute(select(models.LogicalService).filter(
            models.LogicalService.device_id == device.id,
            models.LogicalService.service_type == "OS",
            models.LogicalService.is_deleted == False
        ))
        svc = result.scalar_one_or_none()
        
        if svc:
            svc.name = device.os_name
            svc.version = device.os_version
        else:
            svc = models.LogicalService(
                device_id=device.id,
                name=device.os_name,
                version=device.os_version,
                service_type="OS",
                status="Active",
                environment=device.environment or "Production"
            )
            db.add(svc)
        # No internal commit here, calling code handles it

@router.get("/")
async def get_devices(include_deleted: bool = False, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    
    query = select(models.Device).options(selectinload(models.Device.network_interfaces))
    if not include_deleted:
        query = query.filter(models.Device.is_deleted == False)
        
    result = await db.execute(query)
    devices = result.scalars().all()
    
    if not devices:
        return []

    device_ids = [d.id for d in devices]
    
    # Batch fetch locations
    loc_res = await db.execute(select(models.DeviceLocation).filter(models.DeviceLocation.device_id.in_(device_ids)))
    locations = {l.device_id: l for l in loc_res.scalars().all()}
    
    # Batch fetch hardware components for summary
    hw_res = await db.execute(select(models.HardwareComponent).filter(models.HardwareComponent.device_id.in_(device_ids)))
    hw_all = hw_res.scalars().all()
    hw_map = {}
    for h in hw_all:
        if h.device_id not in hw_map: hw_map[h.device_id] = []
        hw_map[h.device_id].append(h)

    # Batch fetch open incidents
    inc_res = await db.execute(select(models.IncidentLog).filter(
        models.IncidentLog.status != "Resolved",
        models.IncidentLog.status != "Prevented"
    ))
    inc_all = inc_res.scalars().all()
    inc_map = {}
    target_device_ids_set = set(device_ids)
    for inc in inc_all:
        impacted = inc.impacted_device_ids or []
        for did in impacted:
            if did in target_device_ids_set:
                inc_map[did] = inc_map.get(did, 0) + 1
    
    rack_ids = {l.rack_id for l in locations.values() if l.rack_id}
    racks = {}
    if rack_ids:
        rack_res = await db.execute(select(models.Rack).filter(models.Rack.id.in_(list(rack_ids))))
        racks = {r.id: r for r in rack_res.scalars().all()}
    
    room_ids = {r.room_id for r in racks.values() if r.room_id}
    rooms = {}
    if room_ids:
        room_res = await db.execute(select(models.Room).filter(models.Room.id.in_(list(room_ids))))
        rooms = {rm.id: rm for rm in room_res.scalars().all()}
        
    site_ids = {rm.site_id for rm in rooms.values() if rm.site_id}
    sites = {}
    if site_ids:
        site_res = await db.execute(select(models.Site).filter(models.Site.id.in_(list(site_ids))))
        sites = {s.id: s for s in site_res.scalars().all()}

    final_devices = []
    for d in devices:
        device_dict = {c.name: getattr(d, c.name) for c in d.__table__.columns}
        
        # Format dates for JSON
        for date_field in ["purchase_date", "install_date", "warranty_end", "eol_date"]:
            val = getattr(d, date_field)
            if val: device_dict[date_field] = val.isoformat()

        # Hardware Summary (Resource Snapshot)
        comps = hw_map.get(d.id, [])
        hw_summary = []
        cpu = sum(c.count for c in comps if c.category == 'CPU')
        mem = sum(c.count for c in comps if c.category == 'Memory')
        disk = sum(c.count for c in comps if c.category == 'Disk')
        # Clever summary: check specs too if possible? 
        # Actually count is most straightforward for now.
        if cpu: hw_summary.append(f"{cpu}x CPU")
        if mem: hw_summary.append(f"{mem}x MEM")
        if disk: hw_summary.append(f"{disk}x DSK")
        device_dict["hardware_summary"] = " / ".join(hw_summary) if hw_summary else "No Components"

        # Hardware Age
        age_str = "N/A"
        ref_date = d.install_date or d.purchase_date
        if ref_date:
            delta = datetime.now() - ref_date
            years = delta.days // 365
            months = (delta.days % 365) // 30
            if years > 0: age_str = f"{years}y {months}m"
            else: age_str = f"{months}m"
        device_dict["hardware_age"] = age_str

        # Incidents Indicator
        device_dict["open_incident_count"] = inc_map.get(d.id, 0)

        # Multi-IP Summary
        ips = [i.ip_address for i in d.network_interfaces if i.ip_address]
        device_dict["all_ips"] = ips

        loc = locations.get(d.id)
        rack_name, site_name, u_start = None, "Unplaced", None
        
        if loc:
            u_start = loc.start_unit
            rack = racks.get(loc.rack_id)
            if rack:
                rack_name = rack.name
                room = rooms.get(rack.room_id)
                if room:
                    site = sites.get(room.site_id)
                    if site:
                        site_name = site.name

        device_dict.update({
            "rack_name": rack_name, 
            "site_name": site_name, 
            "u_start": u_start, 
            "size_u": d.size_u,
            "mount_orientation": loc.orientation if loc else None,
            "mount_depth": loc.depth if loc else None
        })
        final_devices.append(device_dict)
    return final_devices

@router.get("/{device_id}/interfaces")
async def get_device_interfaces(device_id: int, db: AsyncSession = Depends(get_db)):
    # Fetch interfaces for the device
    res = await db.execute(select(models.NetworkInterface).filter(models.NetworkInterface.device_id == device_id))
    interfaces = res.scalars().all()
    
    # Fetch all connections involving this device to map to interfaces
    conn_res = await db.execute(select(models.PortConnection).filter(
        or_(
            models.PortConnection.source_device_id == device_id,
            models.PortConnection.target_device_id == device_id
        )
    ))
    connections = conn_res.scalars().all()
    
    result = []
    for i in interfaces:
        iface_dict = {c.name: getattr(i, c.name) for c in i.__table__.columns}
        
        # Find connection matching this interface name (port)
        conn = next((c for c in connections if 
            (c.source_device_id == device_id and c.source_port == i.name) or
            (c.target_device_id == device_id and c.target_port == i.name)
        ), None)
        
        if conn:
            peer_device_id = conn.target_device_id if conn.source_device_id == device_id else conn.source_device_id
            peer_port = conn.target_port if conn.source_device_id == device_id else conn.source_port
            peer_ip = conn.target_ip if conn.source_device_id == device_id else conn.source_ip
            peer_mac = conn.target_mac if conn.source_device_id == device_id else conn.source_mac
            peer_vlan = conn.target_vlan if conn.source_device_id == device_id else conn.source_vlan
            
            # Local side info from the connection record
            local_mac = conn.source_mac if conn.source_device_id == device_id else conn.target_mac
            local_vlan = conn.source_vlan if conn.source_device_id == device_id else conn.target_vlan
            local_ip = conn.source_ip if conn.source_device_id == device_id else conn.target_ip

            peer_res = await db.execute(select(models.Device).filter(models.Device.id == peer_device_id))
            peer_dev = peer_res.scalar_one_or_none()
            
            iface_dict["connection"] = {
                "id": conn.id,
                "source_device_id": conn.source_device_id,
                "target_device_id": conn.target_device_id,
                "source_port": conn.source_port,
                "target_port": conn.target_port,
                "source_ip": conn.source_ip,
                "target_ip": conn.target_ip,
                "source_mac": conn.source_mac,
                "target_mac": conn.target_mac,
                "source_vlan": conn.source_vlan,
                "target_vlan": conn.target_vlan,
                "direction": conn.direction,
                "unit": conn.unit,
                "peer_device_id": peer_device_id,
                "peer_device_name": peer_dev.name if peer_dev else "Unknown",
                "peer_port": peer_port,
                "peer_ip": peer_ip,
                "peer_mac": peer_mac,
                "peer_vlan": peer_vlan,
                "local_ip": local_ip,
                "local_mac": local_mac,
                "local_vlan": local_vlan,
                "link_type": conn.link_type,
                "purpose": conn.purpose,
                "speed_gbps": conn.speed_gbps,
                "status": "Connected"
            }
        else:
            iface_dict["connection"] = None
            
        result.append(iface_dict)
        
    return result

@router.post("/")
async def create_device(data: dict, db: AsyncSession = Depends(get_db)):
    required = ["name", "system"]
    for f in required:
        if not data.get(f): raise HTTPException(400, f"Field {f} is mandatory")
    
    dup_res = await db.execute(select(models.Device).filter(models.Device.name == data["name"], models.Device.is_deleted == False))
    if dup_res.scalars().first():
        raise HTTPException(409, "DUPLICATE_HOSTNAME")

    clean_data = filter_valid_columns(models.Device, data)
    for date_f in ["purchase_date", "install_date", "warranty_end", "eol_date"]:
        if date_f in clean_data: clean_data[date_f] = parse_iso_date(clean_data[date_f])
    
    db_device = models.Device(**clean_data)
    db.add(db_device)
    await db.flush() # Flush to get ID

    # Sync OS to services
    await sync_device_to_os(db_device, db)
    
    await db.commit()
    await db.refresh(db_device)

    # Re-fetch for full response consistency (all enriched fields)
    res_list = await get_devices(include_deleted=True, db=db)
    return next((x for x in res_list if x["id"] == db_device.id), None)


@router.put("/{device_id}")
async def update_device(device_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Device).filter(models.Device.id == device_id))
    db_device = result.scalar_one_or_none()
    if not db_device: raise HTTPException(404)
    
    if 'name' in data and data['name'] != db_device.name:
        # Check for duplicate name in ANOTHER active device
        dup_res = await db.execute(select(models.Device).filter(models.Device.name == data["name"], models.Device.is_deleted == False, models.Device.id != device_id))
        if dup_res.scalars().first():
            raise HTTPException(409, "DUPLICATE_HOSTNAME")

    clean_data = filter_valid_columns(models.Device, data)
    # Exclude read-only fields
    for ro_field in ["id", "created_at", "updated_at", "created_by_user_id"]:
        if ro_field in clean_data:
            del clean_data[ro_field]

    for k, v in clean_data.items():
        if k in ["purchase_date", "install_date", "warranty_end", "eol_date"]:
            # Ensure we only pass datetime objects or None to SQLAlchemy for DateTime columns
            setattr(db_device, k, parse_iso_date(v))
        elif k == "metadata_json" and isinstance(v, str):
            try:
                import json
                setattr(db_device, k, json.loads(v))
            except:
                setattr(db_device, k, v)
        else:
            setattr(db_device, k, v)
    
    # Sync OS to services
    await sync_device_to_os(db_device, db)
    
    await db.commit()
    await db.refresh(db_device)
    return db_device

@router.post("/bulk-action")
async def bulk_action(data: dict, db: AsyncSession = Depends(get_db)):
    ids = data.get("ids", [])
    action = data.get("action")
    payload = data.get("payload", {})
    if not ids: return {"status": "no_op"}
    
    if action == "delete":
        await db.execute(update(models.Device).where(models.Device.id.in_(ids)).values(is_deleted=True))
    elif action == "purge":
        await db.execute(delete(models.Device).where(models.Device.id.in_(ids)))
    elif action == "restore":
        # Conflicts check before restore
        res = await db.execute(select(models.Device).where(models.Device.id.in_(ids)))
        to_restore = res.scalars().all()
        
        restored_ids, conflict_ids = [], []
        for d in to_restore:
            # Check if name conflict exists in active inventory
            dup_res = await db.execute(select(models.Device).filter(models.Device.name == d.name, models.Device.is_deleted == False, models.Device.id != d.id))
            if dup_res.scalars().first():
                conflict_ids.append(d.id)
            else:
                d.is_deleted = False
                restored_ids.append(d.id)
        
        await db.commit()
        return {"status": "success", "restored": restored_ids, "conflicts": conflict_ids}
    elif action == "update":
        clean_update = filter_valid_columns(models.Device, payload)
        if clean_update:
            await db.execute(update(models.Device).where(models.Device.id.in_(ids)).values(**clean_update))
    
    await db.commit()
    return {"status": "success"}

@router.get("/{device_id}/hardware")
async def get_hardware(device_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.HardwareComponent).filter(models.HardwareComponent.device_id == device_id))
    return res.scalars().all()

@router.post("/{device_id}/hardware")
async def add_hardware(device_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    # Audit: Ensure data is not empty
    if not data or not any(data.values()): raise HTTPException(400, "Empty hardware data")
    clean = filter_valid_columns(models.HardwareComponent, data)
    comp = models.HardwareComponent(device_id=device_id, **clean)
    db.add(comp); await db.commit(); return comp

@router.get("/{device_id}/secrets")
async def get_secrets(device_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.SecretVault).filter(models.SecretVault.device_id == device_id))
    return res.scalars().all()

@router.post("/{device_id}/secrets")
async def add_secret(device_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    if not data or not data.get("secret_type"): raise HTTPException(400, "Secret type required")
    clean = filter_valid_columns(models.SecretVault, data)
    sec = models.SecretVault(device_id=device_id, **clean)
    db.add(sec); await db.commit(); return sec

@router.get("/relationships/all")
async def get_all_relationships(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.DeviceRelationship))
    return res.scalars().all()

@router.get("/{device_id}/relationships")
async def get_relationships(device_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import or_
    res = await db.execute(select(models.DeviceRelationship).filter(
        or_(
            models.DeviceRelationship.source_device_id == device_id,
            models.DeviceRelationship.target_device_id == device_id
        )
    ))
    return res.scalars().all()

@router.post("/{device_id}/relationships")
async def add_relationship(device_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    target_id = data.get("target_device_id")
    if not target_id: raise HTTPException(400, "Target device ID required")
    if int(target_id) == device_id: raise HTTPException(400, "Cannot link server to itself")
    clean = filter_valid_columns(models.DeviceRelationship, data)
    rel = models.DeviceRelationship(source_device_id=device_id, **clean)
    db.add(rel); await db.commit(); return rel

@router.delete("/{device_id}")
async def delete_device(device_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Device).filter(models.Device.id == device_id))
    db_device = result.scalar_one_or_none()
    if not db_device: raise HTTPException(404)
    db_device.is_deleted = True
    await db.commit()
    return {"status": "success"}

@router.delete("/{resource}/{id}")
async def delete_resource(resource: str, id: int, db: AsyncSession = Depends(get_db)):
    model_map = {"hardware": models.HardwareComponent, "software": models.DeviceSoftware, "secrets": models.SecretVault, "relationships": models.DeviceRelationship}
    if resource not in model_map: raise HTTPException(400)
    await db.execute(delete(model_map[resource]).where(model_map[resource].id == id))
    await db.commit(); return {"status": "success"}

@router.put("/{resource}/{id}")
async def update_resource(resource: str, id: int, data: dict, db: AsyncSession = Depends(get_db)):
    model_map = {"hardware": models.HardwareComponent, "software": models.DeviceSoftware, "secrets": models.SecretVault, "relationships": models.DeviceRelationship}
    if resource not in model_map: raise HTTPException(400)
    
    res = await db.execute(select(model_map[resource]).filter(model_map[resource].id == id))
    item = res.scalar_one_or_none()
    if not item: raise HTTPException(404)
    
    clean = filter_valid_columns(model_map[resource], data)
    for k, v in clean.items():
        if k != "id": setattr(item, k, v)
    
    await db.commit(); return item
