import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
import os
import asyncio

from app.main import app
from app.database import Base, get_db
from app.models import models

# 1. ASYNC TEST PROTOCOL
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///./test_system_grid.db"
engine = create_async_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="module", autouse=True)
async def setup_db():
    if os.path.exists("./test_system_grid.db"): os.remove("./test_system_grid.db")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    if os.path.exists("./test_system_grid.db"): os.remove("./test_system_grid.db")
    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_read_main():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200

@pytest.mark.anyio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "online"}

@pytest.mark.anyio
async def test_provision_asset_full_flow():
    payload = {
        "name": "SRV-ASYNC-01",
        "system": "GRID-ASYNC",
        "status": "Active",
        "model": "R740",
        "type": "Physical",
        "serial_number": "SN-ASYNC-01",
        "asset_tag": "AT-ASYNC-01",
        "owner": "IT-OPS",
        "business_unit": "METROLOGY"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/devices/", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["system"] == "GRID-ASYNC"

@pytest.mark.anyio
async def test_create_site_and_audit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/v1/sites/", json={"name": "ASYNC-SITE", "address": "Cloud"})
        logs_res = await ac.get("/api/v1/audit/")
    logs = logs_res.json()
    assert any(l["target_table"] == "sites" for l in logs)

@pytest.mark.anyio
async def test_settings_initialization():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/settings/initialize")
        assert response.status_code == 200
        assert response.json()["status"] == "initialized"
        
        options_res = await ac.get("/api/v1/settings/options")
        options = options_res.json()
        assert len(options) > 0
        assert any(o["category"] == "LogicalSystem" for o in options)

@pytest.mark.anyio
async def test_global_settings_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Initialize
        await ac.get("/api/v1/settings/initialize")
        
        # Get global settings
        get_res = await ac.get("/api/v1/settings/global")
        assert get_res.status_code == 200
        settings = get_res.json()
        assert settings["app_name"] == "SYSGRID ENGINE"
        
        # Update global settings
        payload = {"app_name": "NEW GRID", "org_name": "ACME CORP"}
        post_res = await ac.post("/api/v1/settings/global", json=payload)
        assert post_res.status_code == 200
        
        # Verify update
        get_res_2 = await ac.get("/api/v1/settings/global")
        settings_2 = get_res_2.json()
        assert settings_2["app_name"] == "NEW GRID"
        assert settings_2["org_name"] == "ACME CORP"
        assert settings_2["site_id"] == "HQ-01" # Should remain same

@pytest.mark.anyio
async def test_monitoring_matrix_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create a device first
        dev_res = await ac.post("/api/v1/devices/", json={
            "name": "MON-SRV", "serial_number": "MON-SN", "asset_tag": "MON-AT",
            "system": "GRID-TEST", "status": "Active", "type": "Physical",
            "owner": "IT", "business_unit": "ENG"
        })
        assert dev_res.status_code == 200, dev_res.text
        dev_id = dev_res.json()["id"]
        
        # Create monitoring item
        payload = {
            "device_id": dev_id,
            "category": "Hardware",
            "status": "Planned",
            "title": "CPU Thermal Monitoring",
            "platform": "Zabbix",
            "purpose": "Prevent overheating",
            "notification_method": "Slack"
        }
        post_res = await ac.post("/api/v1/monitoring/", json=payload)
        assert post_res.status_code == 200
        item_id = post_res.json()["id"]
        
        # Verify get with enrichment
        get_res = await ac.get("/api/v1/monitoring/")
        items = get_res.json()
        assert any(i["id"] == item_id and i["device_name"] == "MON-SRV" for i in items)
        
        # Update
        await ac.put(f"/api/v1/monitoring/{item_id}", json={"status": "Existing"})
        
        # Verify
        get_res_2 = await ac.get("/api/v1/monitoring/")
        assert any(i["id"] == item_id and i["status"] == "Existing" for i in get_res_2.json())

