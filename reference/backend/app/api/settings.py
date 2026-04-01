from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from ..database import get_db
from ..models import models

router = APIRouter(prefix="/settings", tags=["Settings"])

def filter_valid_columns(model, data):
    valid_keys = {c.name for c in model.__table__.columns}
    exclude = {"id", "created_at", "updated_at", "created_by_user_id"}
    return {k: v for k, v in data.items() if k in valid_keys and k not in exclude}

@router.get("/options")
async def get_options(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.SettingOption))
    return result.scalars().all()

@router.post("/options")
async def create_option(data: dict, db: AsyncSession = Depends(get_db)):
    clean_data = filter_valid_columns(models.SettingOption, data)
    if 'id' in clean_data and not clean_data['id']:
        del clean_data['id']
    opt = models.SettingOption(**clean_data)
    db.add(opt)
    await db.commit()
    await db.refresh(opt)
    return opt

@router.put("/options/{opt_id}")
async def update_option(opt_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.SettingOption).filter(models.SettingOption.id == opt_id))
    opt = result.scalar_one_or_none()
    if not opt: raise HTTPException(404, "Option not found")
    
    old_value = opt.value
    new_value = data.get('value', opt.value)
    new_label = data.get('label', opt.label)
    
    # Update associated models if value changed
    if old_value != new_value:
        if opt.category == "Status":
            await db.execute(update(models.Device).where(models.Device.status == old_value).values(status=new_value))
            await db.execute(update(models.LogicalService).where(models.LogicalService.status == old_value).values(status=new_value))
            await db.execute(update(models.MaintenanceWindow).where(models.MaintenanceWindow.status == old_value).values(status=new_value))
        elif opt.category == "Environment":
            await db.execute(update(models.Device).where(models.Device.environment == old_value).values(environment=new_value))
            await db.execute(update(models.LogicalService).where(models.LogicalService.environment == old_value).values(environment=new_value))
        elif opt.category == "DeviceType":
            await db.execute(update(models.Device).where(models.Device.type == old_value).values(type=new_value))
        elif opt.category == "LogicalSystem":
            await db.execute(update(models.Device).where(models.Device.system == old_value).values(system=new_value))
    
    opt.value = new_value
    opt.label = new_label
    opt.description = data.get('description', opt.description)
    
    # Template Protection: If category is ServiceType, check if removing keys that are in use
    if opt.category == "ServiceType" and 'metadata_keys' in data:
        new_keys = set(data.get('metadata_keys', []))
        old_keys = set(opt.metadata_keys or [])
        removed_keys = old_keys - new_keys
        
        if removed_keys:
            # Check if any LogicalService of this type uses these keys
            from sqlalchemy import and_
            usage_query = select(models.LogicalService).filter(models.LogicalService.service_type == opt.value)
            usage_res = await db.execute(usage_query)
            in_use_services = usage_res.scalars().all()
            
            for svc in in_use_services:
                config = svc.config_json or {}
                for rk in removed_keys:
                    if rk in config and config[rk]: # If key exists and has a value
                        raise HTTPException(status_code=400, detail=f"Cannot remove metadata key '{rk}' because it is in use by service '{svc.name}'")
        
        opt.metadata_keys = list(new_keys)
    elif 'metadata_keys' in data:
        opt.metadata_keys = data.get('metadata_keys')
    
    await db.commit()
    await db.refresh(opt)
    return opt

@router.delete("/options/{opt_id}")
async def delete_option(opt_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.SettingOption).filter(models.SettingOption.id == opt_id))
    opt = result.scalar_one_or_none()
    if not opt: raise HTTPException(404, "Option not found")
    
    # Check usage
    in_use = False
    if opt.category == "Status":
        res = await db.execute(select(models.Device).filter(models.Device.status == opt.value))
        if res.scalars().first(): in_use = True
        res = await db.execute(select(models.LogicalService).filter(models.LogicalService.status == opt.value))
        if res.scalars().first(): in_use = True
    elif opt.category == "Environment":
        res = await db.execute(select(models.Device).filter(models.Device.environment == opt.value))
        if res.scalars().first(): in_use = True
        res = await db.execute(select(models.LogicalService).filter(models.LogicalService.environment == opt.value))
        if res.scalars().first(): in_use = True
    elif opt.category == "DeviceType":
        res = await db.execute(select(models.Device).filter(models.Device.type == opt.value))
        if res.scalars().first(): in_use = True
    elif opt.category == "LogicalSystem":
        res = await db.execute(select(models.Device).filter(models.Device.system == opt.value))
        if res.scalars().first(): in_use = True
    elif opt.category == "Manufacturer":
        res = await db.execute(select(models.Device).filter(models.Device.manufacturer == opt.value))
        if res.scalars().first(): in_use = True
    elif opt.category == "Model":
        res = await db.execute(select(models.Device).filter(models.Device.model == opt.value))
        if res.scalars().first(): in_use = True
    elif opt.category == "Owner":
        res = await db.execute(select(models.Device).filter(models.Device.owner == opt.value))
        if res.scalars().first(): in_use = True
    elif opt.category == "BusinessUnit":
        res = await db.execute(select(models.Device).filter(models.Device.business_unit == opt.value))
        if res.scalars().first(): in_use = True
    elif opt.category == "Vendor":
        res = await db.execute(select(models.Device).filter(models.Device.vendor == opt.value))
        if res.scalars().first(): in_use = True
    elif opt.category == "ServiceType":
        res = await db.execute(select(models.LogicalService).filter(models.LogicalService.service_type == opt.value))
        if res.scalars().first(): in_use = True
        
    if in_use:
        raise HTTPException(status_code=400, detail="Cannot delete option that is currently in use")
        
    db.delete(opt)
    await db.commit()
    return {"status": "success"}

@router.get("/ui")
async def get_ui_settings(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.SettingOption).filter(models.SettingOption.category == "UISettings"))
    opts = res.scalars().all()
    
    settings = {
        "status_badged": True,
        "status_colors": {
            "Active": "#10b981",
            "Maintenance": "#f59e0b",
            "Decommissioned": "#f43f5e",
            "Planned": "#3b82f6"
        }
    }
    
    for o in opts:
        if o.label == "status_badged":
            settings["status_badged"] = (o.value == "true")
        elif o.label.startswith("color_"):
            status_name = o.label.replace("color_", "")
            settings["status_colors"][status_name] = o.value
            
    return settings

@router.post("/ui")
async def update_ui_settings(data: dict, db: AsyncSession = Depends(get_db)):
    # Simple clear and set
    from sqlalchemy import delete
    await db.execute(delete(models.SettingOption).where(models.SettingOption.category == "UISettings"))
    
    if "status_badged" in data:
        db.add(models.SettingOption(category="UISettings", label="status_badged", value="true" if data["status_badged"] else "false"))
    
    if "status_colors" in data:
        for status_name, color in data["status_colors"].items():
            db.add(models.SettingOption(category="UISettings", label=f"color_{status_name}", value=color))
            
    await db.commit()
    return {"status": "success"}

@router.get("/global")
async def get_global_settings(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.SettingOption).filter(models.SettingOption.category == "AppGlobal"))
    opts = res.scalars().all()
    
    settings = {
        "app_name": "SYSGRID ENGINE",
        "org_name": "Global Infrastructure Corp",
        "site_id": "HQ-01",
        "retention_days": "30",
        "maintenance_mode": "false",
        "default_timezone": "UTC",
        "dashboard_refresh_interval": "60",
        "security_level": "Standard",
        "audit_log_level": "Full",
        "ui_primary_color": "#3b82f6",
        "ui_accent_color": "#10b981",
        "support_email": "admin@infra.local"
    }
    
    for o in opts:
        settings[o.label] = o.value
            
    return settings

@router.post("/global")
async def update_global_settings(data: dict, db: AsyncSession = Depends(get_db)):
    for key, value in data.items():
        res = await db.execute(select(models.SettingOption).filter(
            models.SettingOption.category == "AppGlobal",
            models.SettingOption.label == key
        ))
        opt = res.scalar_one_or_none()
        if opt:
            opt.value = str(value)
        else:
            db.add(models.SettingOption(category="AppGlobal", label=key, value=str(value)))
            
    await db.commit()
    return {"status": "success"}

@router.get("/initialize")
async def initialize_settings(db: AsyncSession = Depends(get_db)):
    # Simple check if already initialized
    res = await db.execute(select(models.SettingOption))
    if res.scalars().first():
        # Even if initialized, check if AppGlobal exists, if not, add it
        res_global = await db.execute(select(models.SettingOption).filter(models.SettingOption.category == "AppGlobal"))
        if not res_global.scalars().first():
             global_defaults = [
                ("AppGlobal", "app_name", "SYSGRID ENGINE"),
                ("AppGlobal", "org_name", "Global Infrastructure Corp"),
                ("AppGlobal", "site_id", "HQ-01"),
                ("AppGlobal", "retention_days", "30"),
                ("AppGlobal", "maintenance_mode", "false"),
                ("AppGlobal", "default_timezone", "UTC"),
                ("AppGlobal", "dashboard_refresh_interval", "60"),
                ("AppGlobal", "security_level", "Standard"),
                ("AppGlobal", "audit_log_level", "Full"),
                ("AppGlobal", "ui_primary_color", "#3b82f6"),
                ("AppGlobal", "ui_accent_color", "#10b981"),
                ("AppGlobal", "support_email", "admin@infra.local")
            ]
             for cat, key, val in global_defaults:
                db.add(models.SettingOption(category=cat, label=key, value=val))
             await db.commit()
        return {"status": "already_initialized"}
        
    defaults = [
        # Logical Systems
        ("LogicalSystem", "SAP ERP", "Enterprise Resource Planning"),
        ("LogicalSystem", "HR-Core", "Human Resources Core System"),
        ("LogicalSystem", "Sales-B2B", "B2B Sales Portal"),
        ("LogicalSystem", "IT-Infra", "IT Infrastructure"),
        ("LogicalSystem", "DevOps", "DevOps Platform"),
        # Device Types
        ("DeviceType", "Physical", "Bare metal hardware"),
        ("DeviceType", "Virtual", "Virtual machine or instance"),
        ("DeviceType", "Storage", "Storage array or appliance"),
        ("DeviceType", "Switch", "Network switch or router"),
        ("DeviceType", "Firewall", "Network firewall appliance"),
        ("DeviceType", "Load Balancer", "Load balancer appliance"),
        # Operational Status
        ("Status", "Planned", "Scheduled for deployment"),
        ("Status", "Active", "Operational and healthy"),
        ("Status", "Maintenance", "Undergoing scheduled maintenance"),
        ("Status", "Standby", "Powered on, not serving traffic"),
        ("Status", "Offline", "Powered off or unreachable"),
        ("Status", "Decommissioned", "Retired from service"),
        # Environments
        ("Environment", "Production", "Live user traffic"),
        ("Environment", "Staging", "Pre-production staging"),
        ("Environment", "QA", "Quality Assurance and Testing"),
        ("Environment", "Dev", "Development and Staging"),
        ("Environment", "DR", "Disaster Recovery Node"),
        ("Environment", "Lab", "Lab or sandbox environment"),
        # Business Units
        ("BusinessUnit", "Engineering", "Engineering & R&D"),
        ("BusinessUnit", "Operations", "IT Operations"),
        ("BusinessUnit", "Finance", "Finance & Accounting"),
        ("BusinessUnit", "HR", "Human Resources"),
        ("BusinessUnit", "Sales", "Sales & Business Development"),
        ("BusinessUnit", "Security", "Information Security"),
        # Semiconductor Impact Categories
        ("ImpactCategory", "Wafer Loss / Scrap", "Direct production material loss"),
        ("ImpactCategory", "Yield Degradation", "Reduced output quality"),
        ("ImpactCategory", "Tool Blockage (Down)", "Manufacturing equipment stop"),
        ("ImpactCategory", "Throughput Slow-down", "Bottleneck in production flow"),
        ("ImpactCategory", "MES Connectivity Gap", "Data loss between factory and server"),
        ("ImpactCategory", "Recipe Desync", "Incorrect process parameters"),
        ("ImpactCategory", "SPC Violation", "Statistical Process Control outlier"),
        ("ImpactCategory", "Cleanroom Violation", "Environmental spec breach"),
        ("ImpactCategory", "Robot / OHT Stalled", "Automated material handling failure"),
        ("ImpactCategory", "Data Integrity Risk", "Traceability or history data at risk"),
    ]
    for cat, val, desc in defaults:
        db.add(models.SettingOption(category=cat, label=val, value=val, description=desc))
        
    global_defaults = [
        ("AppGlobal", "app_name", "SYSGRID ENGINE"),
        ("AppGlobal", "org_name", "Global Infrastructure Corp"),
        ("AppGlobal", "site_id", "HQ-01"),
        ("AppGlobal", "retention_days", "30"),
        ("AppGlobal", "maintenance_mode", "false"),
        ("AppGlobal", "default_timezone", "UTC"),
        ("AppGlobal", "dashboard_refresh_interval", "60"),
        ("AppGlobal", "security_level", "Standard"),
        ("AppGlobal", "audit_log_level", "Full"),
        ("AppGlobal", "ui_primary_color", "#3b82f6"),
        ("AppGlobal", "ui_accent_color", "#10b981"),
        ("AppGlobal", "support_email", "admin@infra.local")
    ]
    for cat, key, val in global_defaults:
        db.add(models.SettingOption(category=cat, label=key, value=val))
        
    service_types = [
        ("Database", ["Engine", "Port", "DBName", "Collation", "StorageType", "ReplicaMode"]),
        ("Web Server", ["ServerType", "Port", "RootPath", "SSLExpiry", "AppPool", "Bindings"]),
        ("Container", ["Runtime", "Image", "Tag", "Namespace", "CPURequest", "MemRequest"]),
        ("Middleware", ["Vendor", "Instance", "QueueDepth", "JVMHeap", "JMXPort"]),
        ("Message Queue", ["Engine", "VHost", "Port", "ClusterMode", "Persistence"]),
        ("Cache", ["Engine", "Port", "MemoryLimit", "EvictionPolicy", "Clustered"]),
        ("OS", ["Distribution", "Kernel", "Architecture", "Patch Level", "EOL Date"]),
        ("Vendor Software", ["Vendor", "Support Contact", "Support Level", "Install Path", "License Tier"]),
        ("Internal App", ["Repository", "Framework", "Primary Dev", "CI/CD Pipeline", "Build Version"]),
        ("External App", ["Vendor Support URL", "Account Manager", "Support Tier", "Installation Manual", "Update Frequency"])
    ]
    for val, keys in service_types:
        db.add(models.SettingOption(category="ServiceType", label=val, value=val, metadata_keys=keys))
        
    await db.commit()
    return {"status": "initialized"}
