"""Tariff, PaymentMethod and Payment models."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import PaymentStatus


class Tariff(Base):
    __tablename__ = "tariffs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(String(255))
    duration_days: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(32), default="test_only")  # test_only | full
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(64))
    code: Mapped[str] = mapped_column(String(32), unique=True)
    logo_url: Mapped[str] = mapped_column(String(512), default="")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tariff_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("tariffs.id", ondelete="SET NULL"), nullable=True
    )
    method: Mapped[str] = mapped_column(String(32), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    amount: Mapped[int] = mapped_column(Integer, default=0)
    # To'lov toifasi — daromad statistikasini aniq ajratish uchun:
    #   "tariff"    — obuna tarifi (tariff_id ham to'ldiriladi)
    #   "real_exam" — real imtihon bir martalik kirishi (tariff_id=None)
    #   "teacher"   — ustoz maslahati (tariff_id=None)
    # Eski yozuvlar uchun NULL (migratsiya phone bo'yicha backfill qiladi).
    category: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, index=True
    )
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.pending, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
