"""Chegirma promokodlari sxemalari (admin CRUD)."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import Field, field_validator

from app.schemas.common import CamelModel

# Faqat lotin katta harf va raqamlar (4-32 belgi) — sodda, XSS/injection xavfsiz.
_CODE_RE = re.compile(r"^[A-Z0-9]{4,32}$")


class PromoCodeRead(CamelModel):
    id: str
    code: str
    discount_percent: int
    is_active: bool
    used_count: int
    created_at: datetime


class PromoCodeCreate(CamelModel):
    code: str = Field(min_length=4, max_length=32)
    discount_percent: int = Field(ge=1, le=100)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not _CODE_RE.match(v):
            raise ValueError(
                "Promokod faqat lotin harf va raqamlardan iborat bo'lsin (4-32 belgi)"
            )
        return v


class PromoCodeUpdate(CamelModel):
    discount_percent: Optional[int] = Field(default=None, ge=1, le=100)
    is_active: Optional[bool] = None
