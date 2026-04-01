import asyncio
from app.database import AsyncSessionLocal
from app.models import models
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(models.Device))
        devs = res.scalars().all()
        for d in devs:
            print(f"{d.id}: {d.name} ({d.type})")

if __name__ == "__main__":
    asyncio.run(run())
