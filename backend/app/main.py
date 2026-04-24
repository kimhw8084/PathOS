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

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("PathOS")
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
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
    title="PathOS API",
    description="Metrology Automation & Knowledge Hub Backend",
    version="1.0.0",
    lifespan=lifecycle
)

# CORS Configuration
origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5174,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5174").split(",")
origins = [o.strip() for o in origins_raw if o.strip()]
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
        "message": "Welcome to the PathOS API",
        "status": "online",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/api")
@app.get("/api/")
async def api_root():
    return {
        "message": "PathOS API Gateway",
        "status": "online",
        "version": "1.0.0"
    }

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "PathOS", "version": "1.0.0"}

from .api import workflows, taxonomy, tasks, settings, media, executions, projects

app.include_router(workflows.router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(taxonomy.router, prefix="/api/taxonomy", tags=["Taxonomy"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(media.router, prefix="/api/media", tags=["Media"])
app.include_router(executions.router, prefix="/api/executions", tags=["Executions"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8085"))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
