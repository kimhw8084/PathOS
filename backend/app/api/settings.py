from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Any, Optional
import asyncio
import sys
import os
import tempfile
import json
from datetime import datetime
from ..database import get_db
from ..models.models import SystemParameter, ParameterLog
from ..schemas.schemas import SystemParameterUpdate, SystemParameterRead, ParameterLogRead
from pydantic import BaseModel

router = APIRouter(tags=["settings"])

FIXED_PARAMETERS = ["TOOL_ID", "HARDWARE_FAMILY", "TRIGGER_ARCHITECTURE", "OUTPUT_CLASSIFICATION"]

@router.get("/parameters", response_model=List[SystemParameterRead])
async def list_parameters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemParameter))
    return result.scalars().all()

@router.put("/parameters/{key}", response_model=SystemParameterRead)
async def update_parameter(key: str, data: SystemParameterUpdate, db: AsyncSession = Depends(get_db)):
    if key not in FIXED_PARAMETERS:
        raise HTTPException(status_code=403, detail="Adding new parameters is not allowed")
        
    result = await db.execute(select(SystemParameter).where(SystemParameter.key == key))
    param = result.scalar_one_or_none()
    
    if not param:
        param = SystemParameter(key=key)
        db.add(param)
    
    param.label = data.label
    param.description = data.description
    param.is_dynamic = data.is_dynamic
    param.manual_values = data.manual_values
    param.python_code = data.python_code
    
    await db.commit()
    await db.refresh(param)
    return param

async def run_parameter_logic(param: SystemParameter, db: AsyncSession):
    start_time = datetime.now()
    found_values = []
    error_msg = None
    status = "SUCCESS"

    if param.is_dynamic:
        if not param.python_code:
            status = "FAILED"
            error_msg = "No Python code provided"
        else:
            wrapper_code = f"""
import json
import sys
import pandas as pd

{param.python_code}

try:
    if 'result' in locals():
        output = result
    elif 'df' in locals():
        output = df.iloc[:, 0].tolist() if isinstance(df, pd.DataFrame) else df
    else:
        output = []
    
    print("---JSON_START---")
    print(json.dumps({{"values": list(output)}}))
    print("---JSON_END---")
except Exception as e:
    print("---JSON_START---")
    print(json.dumps({{"error": str(e)}}))
    print("---JSON_END---")
"""
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as tmp:
                    tmp.write(wrapper_code)
                    tmp_path = tmp.name

                proc = await asyncio.create_subprocess_exec(
                    sys.executable, tmp_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
                    stdout_str = stdout.decode().strip()
                    stderr_str = stderr.decode().strip()

                    if proc.returncode != 0:
                        status = "FAILED"
                        error_msg = stderr_str or f"Exit code {proc.returncode}"
                    elif "---JSON_START---" in stdout_str:
                        json_part = stdout_str.split("---JSON_START---")[1].split("---JSON_END---")[0].strip()
                        output_data = json.loads(json_part)
                        if "error" in output_data:
                            status = "FAILED"
                            error_msg = output_data["error"]
                        else:
                            found_values = output_data["values"]
                    else:
                        status = "FAILED"
                        error_msg = "No JSON output found"
                except asyncio.TimeoutError:
                    proc.kill()
                    status = "FAILED"
                    error_msg = "Timeout (30s)"
            except Exception as e:
                status = "FAILED"
                error_msg = str(e)
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
    else:
        found_values = param.manual_values or []

    execution_time = (datetime.now() - start_time).total_seconds()
    
    # Logic for discrepancies
    # If it's the first time running (cached_values is None), we just set them
    if param.cached_values is None:
        param.cached_values = found_values
        param.has_discrepancy = False
        param.pending_values = None
    else:
        # Compare sets of values
        current_set = set(param.cached_values)
        found_set = set(found_values)
        
        if current_set != found_set:
            status = "DISCREPANCY"
            param.has_discrepancy = True
            param.pending_values = found_values
            error_msg = f"Discrepancy found: {len(found_set)} items vs {len(current_set)} existing"
        else:
            param.has_discrepancy = False
            param.pending_values = None

    param.last_executed = datetime.now()
    
    # Log the run
    log = ParameterLog(
        parameter_key=param.key,
        status=status,
        message=error_msg,
        found_values=found_values,
        execution_time=execution_time
    )
    db.add(log)
    await db.commit()
    return { "status": status, "values": found_values, "error": error_msg }

@router.post("/parameters/{key}/execute")
async def execute_parameter(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemParameter).where(SystemParameter.key == key))
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    
    return await run_parameter_logic(param, db)

@router.get("/parameters/{key}/logs", response_model=List[ParameterLogRead])
async def list_parameter_logs(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ParameterLog)
        .where(ParameterLog.parameter_key == key)
        .order_by(ParameterLog.timestamp.desc())
        .limit(50)
    )
    return result.scalars().all()

@router.post("/parameters/{key}/resolve")
async def resolve_discrepancy(key: str, action: str, db: AsyncSession = Depends(get_db)):
    # action: "CONFIRM" (overwrite cached with pending) or "IGNORE" (clear pending)
    result = await db.execute(select(SystemParameter).where(SystemParameter.key == key))
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    
    if action == "CONFIRM":
        if param.pending_values is not None:
            param.cached_values = param.pending_values
    
    param.pending_values = None
    param.has_discrepancy = False
    await db.commit()
    return param

async def run_all_parameters(db: AsyncSession):
    result = await db.execute(select(SystemParameter))
    params = result.scalars().all()
    
    # Ensure fixed params exist
    existing_keys = [p.key for p in params]
    for key in FIXED_PARAMETERS:
        if key not in existing_keys:
            new_param = SystemParameter(key=key, label=key.replace('_', ' ').title(), is_dynamic=False, manual_values=[])
            db.add(new_param)
            await db.commit()
            params.append(new_param)
            
    for param in params:
        await run_parameter_logic(param, db)
