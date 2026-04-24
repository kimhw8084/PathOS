import os
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile


router = APIRouter()

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    ext = os.path.splitext(file.filename or "")[1] or ".png"
    token = f"{uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, token)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    return {
        "id": token,
        "url": f"/uploads/{token}",
        "label": file.filename or "Uploaded Asset",
        "file_name": file.filename or token,
        "mime_type": file.content_type,
        "uploaded_at": datetime.utcnow().isoformat(),
        "type": "image",
    }
