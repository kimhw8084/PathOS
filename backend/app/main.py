import os
import asyncio
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import logging
import traceback
from contextlib import asynccontextmanager
from .database import engine, init_db, SessionLocal
from .api.settings import run_all_parameters
from .config import config_value, get_upload_dir

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("PathOS")
UPLOAD_DIR = str(get_upload_dir())
API_PREFIX = str(config_value("network", "backend", "api_prefix", default="/api"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def hourly_parameter_task():
    while True:
        try:
            async with SessionLocal() as db:
                logger.info("Executing background parameter refresh...")
                await run_all_parameters(db)
                logger.info("Background parameter refresh complete.")
        except Exception as e:
            logger.error(f"Error in background parameter task: {str(e)}")
        
        # Sleep for 1 hour
        await asyncio.sleep(3600)

@asynccontextmanager
async def lifecycle(app: FastAPI):
    # Startup: Initialize DB and Print Banner
    logger.info("Initializing PathOS Backend...")
    try:
        await init_db()
        logger.info("Database initialized successfully.")
        
        # Initial run and start hourly task
        asyncio.create_task(hourly_parameter_task())
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
    yield
    # Shutdown: Cleanup
    logger.info("Shutting down PathOS Backend...")
    await engine.dispose()

app = FastAPI(
    title=config_value("app", "name", default="PathOS API"),
    description=config_value("app", "description", default="Workflow operations platform backend"),
    version=config_value("app", "version", default="1.0.0"),
    lifespan=lifecycle
)

# CORS Configuration
origins = config_value("network", "backend", "allowed_origins", default=[])
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
    tb = traceback.format_exc()
    logger.error(f"Global Exception caught: {str(exc)}")
    logger.error(tb)
    
    status_code = 500
    detail = str(exc)
    
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail = exc.detail

    return JSONResponse(
        status_code=status_code,
        content={
            "detail": detail,
            "type": exc.__class__.__name__,
            "traceback": tb,
            "path": request.url.path,
            "method": request.method
        }
    )

@app.get("/")
async def root():
    return {
        "message": f"Welcome to the {config_value('app', 'name', default='PathOS')} API",
        "status": "online",
        "docs": "/docs",
        "health": "/health"
    }

@app.get(API_PREFIX)
@app.get(f"{API_PREFIX}/")
async def api_root():
    return {
        "message": f"{config_value('app', 'name', default='PathOS')} API Gateway",
        "status": "online",
        "version": config_value("app", "version", default="1.0.0")
    }

@app.get("/health")
@app.get(f"{API_PREFIX}/health")
async def health_check():
    return {
        "status": "healthy",
        "service": config_value("app", "service_name", default="PathOS"),
        "version": config_value("app", "version", default="1.0.0")
    }

from .api import workflows, taxonomy, tasks, settings, media, executions, projects

app.include_router(workflows.router, prefix=f"{API_PREFIX}/workflows", tags=["Workflows"])
app.include_router(taxonomy.router, prefix=f"{API_PREFIX}/taxonomy", tags=["Taxonomy"])
app.include_router(tasks.router, prefix=f"{API_PREFIX}/tasks", tags=["Tasks"])
app.include_router(settings.router, prefix=f"{API_PREFIX}/settings", tags=["Settings"])
app.include_router(media.router, prefix=f"{API_PREFIX}/media", tags=["Media"])
app.include_router(executions.router, prefix=f"{API_PREFIX}/executions", tags=["Executions"])
app.include_router(projects.router, prefix=f"{API_PREFIX}/projects", tags=["Projects"])
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if __name__ == "__main__":
    import uvicorn
    host = str(config_value("network", "backend", "host", default="0.0.0.0"))
    port = int(config_value("network", "backend", "port", default=8085))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
