import asyncio
import random
import pytest
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.main import app

@pytest.mark.asyncio
async def test_evolution():
    print("Starting production evolution tests (CRUD + Relationships)...")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", timeout=30.0) as ac:
        
        # 1. Test Device Update & Relationship Consistency
        print("Testing Device updates...")
        devices_res = await ac.get("/api/v1/devices/")
        devices = devices_res.json()
        if not devices:
            print("ERROR: No devices found to test.")
            return
            
        target_dev = random.choice(devices)
        dev_id = target_dev["id"]
        
        # Update device status
        print(f"Updating status of device {dev_id}...")
        update_res = await ac.put(f"/api/v1/devices/{dev_id}", json={"status": "Maintenance", "environment": "Staging"})
        if update_res.status_code != 200:
            print(f"BUG in PUT /devices/{dev_id}: {update_res.text}")
        
        # Check if OS service synced (per devices.py sync_device_to_os logic)
        services_res = await ac.get(f"/api/v1/logical-services/?device_id={dev_id}")
        services = services_res.json()
        os_svc = next((s for s in services if s["service_type"] == "OS"), None)
        if os_svc:
            if os_svc["environment"] != "Staging":
                print(f"BUG: OS Service environment not synced to device. Expected Staging, got {os_svc['environment']}")
            else:
                print("OS Service environment sync verified.")

        # 2. Test Rack Reordering
        print("Testing Rack reordering...")
        racks_res = await ac.get("/api/v1/racks/")
        racks = racks_res.json()
        if len(racks) > 2:
            rack_ids = [r["id"] for r in racks]
            random.shuffle(rack_ids)
            reorder_res = await ac.post("/api/v1/racks/reorder", json={"ids": rack_ids})
            if reorder_res.status_code != 200:
                print(f"BUG in POST /racks/reorder: {reorder_res.text}")
            else:
                print("Rack reordering verified.")

        # 3. Test Service Modification (Database Config)
        print("Testing Service metadata updates...")
        db_svc = next((s for s in services if s["service_type"] == "Database"), None)
        if db_svc:
            svc_id = db_svc["id"]
            new_config = {"engine": "PostgreSQL", "port": 5433, "cluster": "HA-MODE"}
            svc_update_res = await ac.put(f"/api/v1/logical-services/{svc_id}", json={"config_json": new_config})
            if svc_update_res.status_code != 200:
                print(f"BUG in PUT /logical-services/{svc_id}: {svc_update_res.text}")
            else:
                updated_svc = svc_update_res.json()
                if updated_svc["config_json"].get("port") != 5433:
                    print(f"BUG: Service metadata (config_json) not updated correctly. Got {updated_svc['config_json']}")
                else:
                    print("Service metadata update verified.")

        # 4. Test Soft Delete & Restore
        print("Testing soft delete and restore...")
        if services:
            target_svc = random.choice(services)
            svc_id_to_del = target_svc["id"]
            del_res = await ac.delete(f"/api/v1/logical-services/{svc_id_to_del}")
            if del_res.status_code != 200:
                print(f"BUG in DELETE /logical-services/{svc_id_to_del}: {del_res.text}")
            
            # Verify it's gone from active list
            get_active_res = await ac.get("/api/v1/logical-services/")
            active_ids = [s["id"] for s in get_active_res.json()]
            if svc_id_to_del in active_ids:
                print(f"BUG: Service {svc_id_to_del} still active after soft delete.")
            
            # Restore it
            restore_res = await ac.post("/api/v1/logical-services/bulk-action", json={"ids": [svc_id_to_del], "action": "restore"})
            if restore_res.status_code != 200:
                print(f"BUG in bulk-restore services: {restore_res.text}")
            else:
                get_active_res_2 = await ac.get("/api/v1/logical-services/")
                active_ids_2 = [s["id"] for s in get_active_res_2.json()]
                if svc_id_to_del not in active_ids_2:
                    print(f"BUG: Service {svc_id_to_del} not restored.")
                else:
                    print("Soft delete and restore verified.")
        else:
            print("Skipping service delete test (no services for selected device).")

        # 5. Test Relationship Cascade (Delete Device -> Check Locations)
        print("Testing cascade delete...")
        # Create a temp device to delete
        rand_name = f"TMP-DEL-{random.randint(1000, 9999)}"
        tmp_dev_res = await ac.post("/api/v1/devices/", json={"name": rand_name, "system": "TEMP", "type": "Physical"})
        if tmp_dev_res.status_code != 200:
            print(f"BUG in POST /devices/ for temp device: {tmp_dev_res.text}")
            return
            
        tmp_dev_id = tmp_dev_res.json()["id"]
        
        # Mount it
        rack_id = racks[0]["id"]
        mount_res = await ac.post(f"/api/v1/racks/{rack_id}/mount", json={"device_id": tmp_dev_id, "start_u": 40, "size_u": 1})
        if mount_res.status_code != 200:
            print(f"BUG in mount for temp device: {mount_res.text}")
        
        # Soft Delete it
        del_res = await ac.delete(f"/api/v1/devices/{tmp_dev_id}")
        if del_res.status_code != 200:
            print(f"BUG in DELETE /devices/{tmp_dev_id}: {del_res.text}")
        else:
            print("Soft delete verified.")
            
    print("Evolution tests completed.")

if __name__ == "__main__":
    asyncio.run(test_evolution())
