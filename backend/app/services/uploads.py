"""Question image upload + optimization (Pillow + aiofiles)."""
from __future__ import annotations

import os
import uuid
from io import BytesIO

import aiofiles
from fastapi import HTTPException, UploadFile, status
from PIL import Image

from app.core.config import settings

_ALLOWED = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
_MAX_WIDTH = 1280


async def save_question_image(file: UploadFile) -> str:
    if file.content_type not in _ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Faqat png/jpg/webp formatdagi rasm yuklash mumkin",
        )
    raw = await file.read()
    if len(raw) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rasm hajmi {settings.MAX_UPLOAD_MB}MB dan oshmasligi kerak",
        )
    try:
        img = Image.open(BytesIO(raw)).convert("RGB")
        if img.width > _MAX_WIDTH:
            ratio = _MAX_WIDTH / img.width
            img = img.resize((_MAX_WIDTH, int(img.height * ratio)))
        out = BytesIO()
        img.save(out, format="WEBP", quality=82)
        data = out.getvalue()
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Rasmni o'qib bo'lmadi"
        ) from exc

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.webp"
    path = os.path.join(settings.UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(data)
    return f"/static/{filename}"


# ---------------- Chat biriktirmalari (ustoz-user suhbati) ----------------
# Rasm -> webp'ga siqiladi; fayl -> oq ro'yxatdagi kengaytmalar bilan xomligicha.
_CHAT_FILE_EXT = {".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".zip"}


async def save_chat_attachment(file: UploadFile) -> tuple[str, str, str]:
    """Chat biriktirmasini saqlaydi. Qaytaradi: (url, asl_nomi, turi image|file)."""
    name = file.filename or "fayl"
    if file.content_type in _ALLOWED:
        url = await save_question_image(file)
        return url, name, "image"

    ext = os.path.splitext(name)[1].lower()
    if ext not in _CHAT_FILE_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Faqat rasm (png/jpg/webp) yoki hujjat (pdf/doc/docx/txt/xls/xlsx/zip) yuklash mumkin",
        )
    raw = await file.read()
    if len(raw) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fayl hajmi {settings.MAX_UPLOAD_MB}MB dan oshmasligi kerak",
        )
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(raw)
    return f"/static/{filename}", name, "file"
