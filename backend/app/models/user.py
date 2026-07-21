"""User, Subscription and Referral models."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import Role


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255))
    surname: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    nickname: Mapped[Optional[str]] = mapped_column(
        String(32), unique=True, index=True, nullable=True
    )
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    telegram: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Bog'langan Telegram akkaunt id (bir telegram = bir nik). UNIQUE — DB darajasida
    # majburlanadi: konkurent verify-code'da ham ikkita user bitta telegramga bog'lanmaydi.
    # (SQLite/Postgres'da bir nechta NULL ruxsat — bog'lanmagan userlar muammosiz.)
    telegram_id: Mapped[Optional[str]] = mapped_column(
        String(32), unique=True, index=True, nullable=True
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.user, index=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    # Avto-blok sababi va vaqti (xavfsizlik tizimi to'ldiradi; admin ochganda tozalanadi).
    block_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    blocked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Avto-ochilish vaqti (None = faqat admin ochadi). Eskalatsiya darajasi = block_count.
    block_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    block_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    ref_code: Mapped[Optional[str]] = mapped_column(
        String(16), nullable=True, unique=True, index=True
    )
    referred_by: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    # Promokod bonusi (sarflanadigan balans) — faqat real imtihon sotib olishga.
    bonus_balance: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    subscriptions: Mapped[list["Subscription"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    tariff_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="subscriptions")


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[int] = mapped_column(primary_key=True)
    referrer_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    referred_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    has_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    bonus: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
