"""User schemas."""
from datetime import datetime
from typing import Optional

from pydantic import EmailStr, field_validator

from app.schemas.common import CamelModel


class UserRead(CamelModel):
    id: str
    name: str
    surname: Optional[str] = None
    nickname: Optional[str] = None
    phone: str
    email: Optional[str] = None
    telegram: Optional[str] = None
    telegram_id: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    is_blocked: bool
    block_reason: Optional[str] = None
    blocked_at: Optional[datetime] = None
    block_until: Optional[datetime] = None
    block_count: int = 0
    ref_code: Optional[str] = None
    created_at: datetime
    subscription_active: bool = False
    subscription_expires_at: Optional[datetime] = None


class UserUpdate(CamelModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    email: Optional[EmailStr] = None
    telegram: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def _blank_email_to_none(cls, v: object) -> object:
        # Frontend profil formasi email maydonini har doim yuboradi (bo'sh bo'lsa "").
        # Bo'sh string EmailStr validatsiyasidan o'tmaydi (422) -> emaili yo'q foydalanuvchi
        # profilini UMUMAN saqlay olmasdi. Bo'sh/probelni None ga aylantiramiz
        # (update_me None maydonni o'zgartirmaydi -> mavjud email saqlanadi).
        if isinstance(v, str) and not v.strip():
            return None
        return v


class AdminUserUpdate(CamelModel):
    is_blocked: Optional[bool] = None


class UserListResponse(CamelModel):
    items: list[UserRead]
    total: int
    page: int
    page_size: int
