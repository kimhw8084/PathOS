from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
import pandas as pd
import io
from ..database import get_db
from ..models import models

router = APIRouter(prefix="/import", tags=["Intelligence Engine"])

@router.get("/template")
def download_template():
    df = pd.DataFrame(columns=[
        "hostname", "system_name", "status", "model", "manufacturer", "os_name", "os_version", "type", 
        "serial_number", "asset_tag", "power_max", "power_typical",
        "hw_category", "hw_name", "hw_specs", "hw_serial",
        "sw_name", "sw_version", "sw_category"
    ])
    df.loc[0] = ["SRV-001", "ERP-CORE", "Active", "R740", "Dell", "Ubuntu", "22.04", "Physical", "SN123", "AT456", 750, 300, "CPU", "Gold 6130", "2.1GHz", "CPUSN", "Docker", "24.0.7", "Runtime"]
    
    stream = io.BytesIO()
    df.to_csv(stream, index=False)
    stream.seek(0)
    
    return StreamingResponse(
        stream, 
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=SYSGRID_Ingestion_Template.csv"}
    )

async def process_csv(content: bytes, db: AsyncSession):
    # Run pandas in a threadpool to avoid blocking the event loop
    df = await run_in_threadpool(lambda: pd.read_csv(io.BytesIO(content)))
    count = 0
    for _, row in df.iterrows():
        try:
            device_data = {
                "name": str(row.get("hostname", "Unknown")),
                "system": str(row.get("system_name", "Unknown")),
                "status": str(row.get("status", "Active")),
                "model": str(row.get("model", "Unknown")),
                "manufacturer": str(row.get("manufacturer", "Unknown")),
                "os_name": str(row.get("os_name", "Unknown")),
                "os_version": str(row.get("os_version", "Unknown")),
                "type": str(row.get("type", "Physical")),
                "serial_number": str(row.get("serial_number", f"SN-{id(row)}")),
                "asset_tag": str(row.get("asset_tag", f"AT-{id(row)}")),
                "power_max_w": float(row.get("power_max", 0)),
                "power_typical_w": float(row.get("power_typical", 0)),
            }
            db_device = models.Device(**device_data)
            db.add(db_device)
            await db.flush()
            
            if not pd.isna(row.get("hw_category")):
                hw = models.HardwareComponent(
                    device_id=db_device.id,
                    category=row["hw_category"],
                    name=row.get("hw_name", "Unknown"),
                    specs=row.get("hw_specs"),
                    serial_number=row.get("hw_serial")
                )
                db.add(hw)
            count += 1
        except Exception as e:
            print(f"Error processing row: {e}")
            continue
    
    await db.commit()
    return count

@router.post("/csv")
async def import_from_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    try:
        count = await process_csv(content, db)
        return {"status": "success", "count": count}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
