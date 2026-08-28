"""Question image upload + optimization (Pillow + aiofiles)."""
from __future__ import annotations

import os
import shutil
import uuid
from io import BytesIO

import aiofiles
from fastapi import HTTPException, UploadFile, status
from PIL import Image

from app.core.config import settings
from app.core.logging import logger

_ALLOWED = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
_MAX_WIDTH = 1280

# Image ichidagi rasm zaxiralari. app/services/uploads.py -> ../../ = backend/
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
# (manba papkasi, UPLOAD_DIR ichidagi maqsad kichik papkasi)
_SEED_SOURCES = (
    # Savol rasmlari -> /static/question_*.webp
    (os.path.join(_BACKEND_DIR, "seed_3lang", "images"), ""),
    # Yo'l belgilari -> /static/belgilar/1.1.gif
    (os.path.join(_BACKEND_DIR, "seed_belgilar", "rasmlar"), "belgilar"),
)


def _copy_missing(src_dir: str, dst_dir: str) -> int:
    """src_dir dagi fayllarni dst_dir ga ko'chiradi — MAVJUDLARIGA TEGMAYDI."""
    if not os.path.isdir(src_dir):
        logger.info("Zaxira rasmlar papkasi topilmadi: %s", src_dir)
        return 0
    os.makedirs(dst_dir, exist_ok=True)
    copied = 0
    for name in os.listdir(src_dir):
        src = os.path.join(src_dir, name)
        dst = os.path.join(dst_dir, name)
        if not os.path.isfile(src) or os.path.exists(dst):
            continue
        try:
            shutil.copyfile(src, dst)
            copied += 1
        except OSError:
            logger.exception("Rasmni ko'chirib bo'lmadi: %s", name)
    return copied


def restore_seed_images() -> int:
    """Yetishmayotgan rasmlarni zaxiradan UPLOAD_DIR ga ko'chiradi.

    NEGA KERAK: Render'da disk EFEMER (persistent disk yo'q) — har deploy va har
    uyqudan uyg'onishda uploads/ bo'shab qoladi. Natijada savol rasmlari va yo'l
    belgilari 404 qaytarib, sahifalar bo'sh ko'rinardi.

    Mavjud fayllar QAYTA YOZILMAYDI — admin panel orqali yuklangan yoki almashtirilgan
    rasmlar saqlanib qoladi. Qaytaradi: ko'chirilgan fayllar soni.
    """
    total = 0
    for src_dir, sub in _SEED_SOURCES:
        dst_dir = os.path.join(settings.UPLOAD_DIR, sub) if sub else settings.UPLOAD_DIR
        n = _copy_missing(src_dir, dst_dir)
        if n:
            logger.info("Rasmlar tiklandi: %s ta fayl -> %s", n, dst_dir)
        total += n
    return total


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
