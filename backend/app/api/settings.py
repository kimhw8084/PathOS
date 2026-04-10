from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Any
import subprocess
import sys
import os
import tempfile
import json
import pandas as pd
from datetime import datetime
from ..database import get_db
from ..models.models import SystemParameter
from pydantic import BaseModel

router = APIRouter(prefix="/settings", tags=["settings"])

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
def list_parameters(db: Session = Depends(get_db)):
    return db.query(SystemParameter).all()

@router.put("/parameters/{key}")
def update_parameter(key: str, data: ParameterUpdate, db: Session = Depends(get_db)):
    param = db.query(SystemParameter).filter(SystemParameter.key == key).first()
    if not param:
        param = SystemParameter(key=key)
        db.add(param)
    
    param.label = data.label
    param.description = data.description
    param.is_dynamic = data.is_dynamic
    param.manual_values = data.manual_values
    param.python_code = data.python_code
    
    db.commit()
    db.refresh(param)
    return param

@router.post("/parameters/{key}/execute")
def execute_parameter(key: str, db: Session = Depends(get_db)):
    param = db.query(SystemParameter).filter(SystemParameter.key == key).first()
    if not param or not param.is_dynamic or not param.python_code:
        raise HTTPException(status_code=400, detail="Parameter is not dynamic or has no code")

    # Security: Run in a separate process
    # The script should define a 'result' variable or print JSON
    wrapper_code = f"""
import json
import pandas as pd
import sys

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
    
    print(json.dumps({{"values": list(output)}}))
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
"""

    try:
        start_time = datetime.now()
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as tmp:
            tmp.write(wrapper_code)
            tmp_path = tmp.name

        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=30 # 30 second limit
        )
        
        os.unlink(tmp_path)
        execution_time = (datetime.now() - start_time).total_seconds()

        if result.returncode != 0:
            return { "values": [], "execution_time": execution_time, "error": result.stderr }

        output_data = json.loads(result.stdout.strip())
        
        if "values" in output_data:
            param.cached_values = output_data["values"]
            param.last_executed = datetime.now()
            db.commit()
            
        return { **output_data, "execution_time": execution_time }

    except Exception as e:
        return { "values": [], "execution_time": 0, "error": str(e) }
