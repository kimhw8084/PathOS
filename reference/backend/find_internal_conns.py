import asyncio
from app.database import AsyncSessionLocal
from app.models import models
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as db:
        # Get all racks and their devices
        res_racks = await db.execute(select(models.Rack))
        racks = res_racks.scalars().all()
        
        # Map device_id to rack_id
        dev_to_rack = {}
        res_locs = await db.execute(select(models.DeviceLocation))
        locs = res_locs.scalars().all()
        for l in locs:
            dev_to_rack[l.device_id] = l.rack_id
            
        # Get all connections
        res_conns = await db.execute(select(models.PortConnection))
        conns = res_conns.scalars().all()
        
        # Count connections within same rack
        rack_internal_conns = {} # device_id -> [connected_device_ids]
        
        for c in conns:
            s_id = c.source_device_id
            t_id = c.target_device_id
            if s_id in dev_to_rack and t_id in dev_to_rack:
                if dev_to_rack[s_id] == dev_to_rack[t_id]:
                    # Same rack!
                    if s_id not in rack_internal_conns: rack_internal_conns[s_id] = []
                    rack_internal_conns[s_id].append(t_id)
                    
                    if t_id not in rack_internal_conns: rack_internal_conns[t_id] = []
                    rack_internal_conns[t_id].append(s_id)

        print("Devices with multiple internal rack connections:")
        found = False
        for dev_id, peers in rack_internal_conns.items():
            if len(peers) >= 2:
                res_dev = await db.execute(select(models.Device).filter(models.Device.id == dev_id))
                dev = res_dev.scalar_one_or_none()
                if dev:
                    print(f"ID: {dev.id}, Name: {dev.name}, Peer IDs: {peers}")
                    found = True
        
        if not found:
            print("None found. I will seed a specific case.")

if __name__ == "__main__":
    asyncio.run(run())
