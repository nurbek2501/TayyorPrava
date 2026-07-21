"""Ustoz tizimi Pydantic sxemalari (camelCase API)."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import Field, field_validator, model_validator

from app.schemas.common import CamelModel

# Biriktirma URL faqat SERVERGA yuklangan fayl bo'lishi mumkin (/chat-upload qaytaradigan
# format: /static/<32-hex>.<ext>). Client ixtiyoriy tashqi URL / javascript: / traversal
# yubora olmaydi — aks holda chatda tashqi treker/fishing/XSS ko'rinardi.
_ATTACH_URL_RE = re.compile(r"^/static/[a-f0-9]{32}\.[a-z0-9]{2,5}$")


# ---------------- Tariff ----------------
class TeacherTariffRead(CamelModel):
    id: str
    days: int
    price: int
    is_active: bool


class TeacherTariffCreate(CamelModel):
    days: int = Field(ge=1, le=365)
    price: int = Field(ge=0)


# ---------------- Teacher (user tomoni) ----------------
class TeacherPublic(CamelModel):
    id: str  # teacher_profile id
    name: str
    surname: Optional[str] = None
    experience_years: int
    tariffs: list[TeacherTariffRead]
    has_access: bool = False
    access_expires_at: Optional[datetime] = None
    # Joriy user bilan suhbat holati (thread mavjud bo'lsagina) — frontendda
    # "ustoz javob berdi" bildirishnomasini aniqlash uchun (awaiting_reply=False +
    # last_msg_at o'zgarishi = yangi javob).
    thread_awaiting_reply: Optional[bool] = None
    thread_last_msg_at: Optional[datetime] = None


# ---------------- Teacher (admin tomoni) ----------------
class TeacherAdminRead(CamelModel):
    id: str
    user_id: str
    name: str
    surname: Optional[str] = None
    phone: str
    telegram: Optional[str] = None
    nickname: Optional[str] = None
    experience_years: int
    is_active: bool
    created_at: datetime
    tariffs: list[TeacherTariffRead]


class TeacherCreate(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    surname: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=5, max_length=32)
    telegram: Optional[str] = Field(default=None, max_length=64)
    experience_years: int = Field(ge=0, le=60)
    login: str = Field(min_length=4, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    password_confirm: str = Field(min_length=8, max_length=128)

    @field_validator("login")
    @classmethod
    def login_alnum(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("Login faqat lotin harf va raqamlardan iborat bo'lsin")
        return v


class TeacherUpdate(CamelModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    experience_years: Optional[int] = Field(default=None, ge=0, le=60)
    is_active: Optional[bool] = None


# ---------------- Purchase ----------------
class TeacherPurchaseRequest(CamelModel):
    tariff_id: str
    method: Optional[str] = None


class TeacherPurchaseResponse(CamelModel):
    ok: bool
    expires_at: datetime


# ---------------- Chat ----------------
class ChatMessageRead(CamelModel):
    id: str
    sender: str  # "user" | "teacher"
    text: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    edited_at: Optional[datetime] = None
    created_at: datetime


class AdminChatMessageRead(ChatMessageRead):
    """Admin ko'rinishi — o'chirilgan/flagged xabarlar ham (moderatsiya)."""

    deleted_at: Optional[datetime] = None
    flagged: bool = False
    has_link: bool = False


class ChatSendRequest(CamelModel):
    text: Optional[str] = Field(default=None, max_length=4000)
    attachment_url: Optional[str] = Field(default=None, max_length=256)
    attachment_name: Optional[str] = Field(default=None, max_length=200)
    attachment_type: Optional[Literal["image", "file"]] = None

    @model_validator(mode="after")
    def _check_attachment(self) -> "ChatSendRequest":
        # Biriktirma URL faqat serverga yuklangan ichki faylga ishora qilishi shart.
        if self.attachment_url is not None and not _ATTACH_URL_RE.match(
            self.attachment_url
        ):
            raise ValueError(
                "attachmentUrl faqat serverga yuklangan fayl bo'lishi mumkin"
            )
        return self


class ChatEditRequest(CamelModel):
    text: str = Field(min_length=1, max_length=4000)


class ChatUploadResponse(CamelModel):
    url: str
    name: str
    type: str  # "image" | "file"


# ---------------- Teacher panel ----------------
class TeacherThreadRead(CamelModel):
    id: str
    user_name: str
    user_nickname: Optional[str] = None
    awaiting_reply: bool
    last_msg_at: Optional[datetime] = None
    last_text: Optional[str] = None


class TeacherChangeLoginRequest(CamelModel):
    new_login: str = Field(min_length=4, max_length=32)
    password: str


# ---------------- Admin moderation ----------------
class AdminThreadRead(CamelModel):
    id: str
    user_name: str
    user_nickname: Optional[str] = None
    teacher_name: str
    last_msg_at: Optional[datetime] = None
    last_text: Optional[str] = None
    flagged_count: int = 0


class AdminFlaggedMessage(CamelModel):
    id: str
    thread_id: str
    sender: str
    sender_name: str
    text: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    has_link: bool
    has_phone: bool = False
    created_at: datetime
