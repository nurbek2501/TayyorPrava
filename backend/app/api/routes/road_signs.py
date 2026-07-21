"""Yo'l belgilari (road signs) — 3 tilli (uz/kaa/ru) reference ma'lumot.

seed_belgilar/yol-belgilari-3til.json ni o'qib beradi (keshlanadi). Rasmlar
/static/belgilar/ orqali xizmat qilinadi. Token talab qilinadi (reference kontent qulflangan).
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user
from app.models.user import User

router = APIRouter(tags=["road-signs"])

_DATA_PATH = (
    Path(__file__).resolve().parents[3] / "seed_belgilar" / "yol-belgilari-3til.json"
)
_cache: dict | None = None


@router.get("/road-signs")
async def get_road_signs(_user: User = Depends(get_current_user)):
    global _cache
    if _cache is None:
        if not _DATA_PATH.exists():
            raise HTTPException(status_code=404, detail="Yo'l belgilari ma'lumoti topilmadi")
        _cache = json.loads(_DATA_PATH.read_text(encoding="utf-8"))
    return _cache
