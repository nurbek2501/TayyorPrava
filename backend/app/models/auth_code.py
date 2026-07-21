"""Ro'yxatdan o'tishni kutayotgan foydalanuvchilar va Telegram tasdiq kodlari."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PendingRegistration(Base):
    """Forma to'ldirilgan, lekin hali Telegram orqali tasdiqlanmagan ro'yxat.

    Tasdiqlangach (verify-code) bu yozuvdan haqiqiy `User` yaratiladi va o'chiriladi.
    """

    __tablename__ = "pending_registrations"

    nickname: Mapped[str] = mapped_column(String(32), primary_key=True)  # kichik harf
    nickname_display: Mapped[str] = mapped_column(String(32))  # asl yozilishi
    first_name: Mapped[str] = mapped_column(String(255))
    last_name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    referred_by: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuthCode(Base):
    """Telegram bot bergan 5 xonali tasdiq kodi (ro'yxat yoki parol tiklash uchun)."""

    __tablename__ = "auth_codes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    nickname: Mapped[str] = mapped_column(String(32), index=True)  # kichik harf
    code: Mapped[str] = mapped_column(String(5))
    purpose: Mapped[str] = mapped_column(String(16))  # "register" | "reset"
    telegram_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
