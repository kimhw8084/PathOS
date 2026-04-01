import asyncio
from sqlalchemy import text
from app.database import engine, Base

import os

async def main():
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "system_grid.db")
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Deleted database: {db_path}")
    else:
        print(f"Database not found: {db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database cleared and tables created.")

if __name__ == "__main__":
    asyncio.run(main())
