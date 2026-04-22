import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import event
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./pathos.db")

# High Concurrency SQLite Settings (WAL mode)
# These are applied via engine events or connection initialization
engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Apply PRAGMAs for high concurrency
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute(f"PRAGMA busy_timeout={os.getenv('SQLITE_BUSY_TIMEOUT', '5000')}")
    cursor.close()

async def init_db():
    async with engine.begin() as conn:
        # For development, we ensure all tables exist. 
        # In production, this would be handled strictly by Alembic.
        await conn.run_sync(Base.metadata.create_all)
