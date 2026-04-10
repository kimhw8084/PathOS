from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Any
import asyncio
import sys
import os
import tempfile
import json
from datetime import datetime
from ..database import get_db
from ..models.models import SystemParameter
from pydantic import BaseModel

router = APIRouter(tags=["settings"])

class ParameterUpdate(BaseModel):
    label: str
    description: str = None
    is_dynamic: bool
    manual_values: List[str] = []
    python_code: str = None

class ParameterExecuteResponse(BaseModel):
    values: List[Any]
    execution_time: float
    error: str = None

@router.get("/parameters")
async def list_parameters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemParameter))
    return result.scalars().all()

@router.put("/parameters/{key}")
async def update_parameter(key: str, data: ParameterUpdate, db: AsyncSession = Depends(get_db)):
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

@router.post("/parameters/{key}/execute")
async def execute_parameter(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemParameter).where(SystemParameter.key == key))
    param = result.scalar_one_or_none()
    
    if not param or not param.is_dynamic or not param.python_code:
        raise HTTPException(status_code=400, detail="Parameter is not dynamic or has no code")

    # Security: Run in a separate process
    # The script should define a 'result' variable or a 'df' Pandas DataFrame
    wrapper_code = f"""
import json
import sys
import pandas as pd

# User code follows
{param.python_code}

# Handle potential outputs
try:
    if 'result' in locals():
        output = result
    elif 'df' in locals():
        output = df.iloc[:, 0].tolist() if isinstance(df, pd.DataFrame) else df
    else:
        output = []
    
    # Use a specific marker for the JSON output to avoid issues with user prints
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
        start_time = datetime.now()
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as tmp:
            tmp.write(wrapper_code)
            tmp_path = tmp.name

        # Use asyncio to run the subprocess without blocking the event loop
        proc = await asyncio.create_subprocess_exec(
            sys.executable, tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except:
                pass
            return { "values": [], "execution_time": 30.0, "error": "Execution timed out (30s limit)" }

        execution_time = (datetime.now() - start_time).total_seconds()
        
        stdout_str = stdout.decode().strip()
        stderr_str = stderr.decode().strip()

        if proc.returncode != 0:
            return { "values": [], "execution_time": execution_time, "error": stderr_str or f"Process exited with code {proc.returncode}" }

        # Extract JSON from markers
        if "---JSON_START---" in stdout_str:
            try:
                json_part = stdout_str.split("---JSON_START---")[1].split("---JSON_END---")[0].strip()
                output_data = json.loads(json_part)
            except (IndexError, json.JSONDecodeError):
                return { "values": [], "execution_time": execution_time, "error": "Failed to parse script output markers" }
        else:
            return { "values": [], "execution_time": execution_time, "error": "Script did not provide required output markers" }
        
        if "values" in output_data:
            param.cached_values = output_data["values"]
            param.last_executed = datetime.now()
            await db.commit()
            
        return { **output_data, "execution_time": execution_time }

    except Exception as e:
        return { "values": [], "execution_time": 0, "error": str(e) }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass
