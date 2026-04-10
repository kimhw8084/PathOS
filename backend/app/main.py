import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import traceback
from contextlib import asynccontextmanager
from .database import engine, init_db

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("PathOS")

@asynccontextmanager
async def lifecycle(app: FastAPI):
    # Startup: Initialize DB and Print Banner
    logger.info("Initializing PathOS Backend...")
    try:
        await init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
    yield
    # Shutdown: Cleanup
    logger.info("Shutting down PathOS Backend...")
    await engine.dispose()

app = FastAPI(
    title="PathOS API",
    description="Metrology Automation & Knowledge Hub Backend",
    version="1.0.0",
    lifespan=lifecycle
)

# CORS Configuration
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler (Ironclad Fortress)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global Exception caught: {str(exc)}")
    logger.error(traceback.format_exc())
    
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "type": "HTTPException"}
        )
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred. The PathOS Fortress has logged the event.",
            "type": "InternalServerError"
        }
    )

@app.get("/")
async def root():
    return {
        "message": "Welcome to the PathOS API",
        "status": "online",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "PathOS", "version": "1.0.0"}

from .api import workflows, taxonomy, tasks, settings

app.include_router(workflows.router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(taxonomy.router, prefix="/api/taxonomy", tags=["Taxonomy"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
