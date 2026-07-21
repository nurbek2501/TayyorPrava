"""Markaziy logging sozlamasi.

Daraja .env DEBUG ga qarab (DEBUG=True -> DEBUG, aks holda INFO). Formatlangan,
stdout'ga (konteyner/journald uchun qulay).
"""
from __future__ import annotations

import logging
import sys

from app.core.config import settings

_CONFIGURED = False
logger = logging.getLogger("app")


def setup_logging() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    level = logging.DEBUG if settings.DEBUG else logging.INFO
    root = logging.getLogger()
    root.setLevel(level)
    # Reload paytida takror handler qo'shilmasin
    if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s")
        )
        root.addHandler(handler)
    # Shovqinli kutubxonalarni jimlatamiz (DEBUG'da ham) — har SQL/ulanishni yozmaydi.
    for noisy in ("aiosqlite", "sqlalchemy.engine", "httpcore", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _CONFIGURED = True
