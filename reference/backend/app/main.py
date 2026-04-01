from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import select, text
from .database import engine, Base, AsyncSessionLocal
from .models import models
from .api import devices, import_engine, networks, security, dashboard, racks, audit, sites, maintenance, logical_services, settings as settings_api, monitoring, troubleshoot, data_flows, intelligence

async def _auto_seed():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(models.SettingOption))
        if res.scalars().first():
            return  # Already seeded

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
            ("Environment", "Dev", "Development environment"),
            ("Environment", "DR", "Disaster Recovery Node"),
            ("Environment", "Lab", "Lab or sandbox environment"),
            # Business Units
            ("BusinessUnit", "Engineering", "Engineering & R&D"),
            ("BusinessUnit", "Operations", "IT Operations"),
            ("BusinessUnit", "Finance", "Finance & Accounting"),
            ("BusinessUnit", "HR", "Human Resources"),
            ("BusinessUnit", "Sales", "Sales & Business Development"),
            ("BusinessUnit", "Security", "Information Security"),
        ]
        for cat, val, desc in defaults:
            db.add(models.SettingOption(category=cat, label=val, value=val, description=desc))

        service_types = [
            ("Database", ["Engine", "Port", "DBName", "Collation", "StorageType", "ReplicaMode"]),
            ("Web Server", ["ServerType", "Port", "RootPath", "SSLExpiry", "AppPool", "Bindings"]),
            ("Container", ["Runtime", "Image", "Tag", "Namespace", "CPURequest", "MemRequest"]),
            ("Middleware", ["Vendor", "Instance", "QueueDepth", "JVMHeap", "JMXPort"]),
            ("Message Queue", ["Engine", "VHost", "Port", "ClusterMode", "Persistence"]),
            ("Cache", ["Engine", "Port", "MemoryLimit", "EvictionPolicy", "Clustered"]),
        ]
        for val, keys in service_types:
            db.add(models.SettingOption(category="ServiceType", label=val, value=val, metadata_keys=keys))

        await db.commit()

from .core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _auto_seed()
    yield

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import traceback

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Capture full traceback
    tb = traceback.format_exc()
    print(f"ERROR: {str(exc)}\n{tb}") # Still log to terminal
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "traceback": tb,
            "path": request.url.path
        }
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router, prefix=settings.API_V1_STR)
app.include_router(import_engine.router, prefix=settings.API_V1_STR)
app.include_router(networks.router, prefix=settings.API_V1_STR)
app.include_router(security.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(racks.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(sites.router, prefix=settings.API_V1_STR)
app.include_router(maintenance.router, prefix=settings.API_V1_STR)
app.include_router(logical_services.router, prefix=settings.API_V1_STR)
app.include_router(settings_api.router, prefix=settings.API_V1_STR)
app.include_router(monitoring.router, prefix=settings.API_V1_STR)
app.include_router(troubleshoot.router, prefix=settings.API_V1_STR)
app.include_router(data_flows.router, prefix=settings.API_V1_STR)
app.include_router(intelligence.router, prefix=settings.API_V1_STR)

@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {"status": "online"}

@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "engine": "Standard Production",
        "mode": "Fully Asynchronous"
    }
