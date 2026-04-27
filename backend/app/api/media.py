import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import get_upload_dir

router = APIRouter()

UPLOAD_DIR = str(get_upload_dir())
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    allowed_exact = {
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    if not file.content_type or not (file.content_type.startswith("image/") or file.content_type in allowed_exact):
        raise HTTPException(status_code=400, detail="Only images and common document attachments are supported")

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
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "type": "image" if file.content_type.startswith("image/") else "document",
    }
