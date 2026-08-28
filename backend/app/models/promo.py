"""Promokodlar: admin yaratgan chegirma kodlari + bonusga sotib olingan shaxsiy kodlar."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    # Chegirma foizi (1-100) — admin belgilaydi. Real imtihon narxiga qo'llanadi.
    discount_percent: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    used_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PersonalPromoCode(Base):
    """Bonusga sotib olingan SHAXSIY promokod.

    Admin yaratgan `PromoCode` dan farqi:
      * FAQAT egasi (`user_id`) ishlata oladi — boshqa akkaunt kiritsa rad etiladi;
      * FAQAT BIR MARTA — `used` bayrog'i bilan (atomik UPDATE orqali belgilanadi,
        shuning uchun bir vaqtda kelgan ikki so'rov ham ikkita kirish ocha olmaydi).

    Alohida jadval: `promo_codes` ga ustun qo'shilsa Postgres'da qo'lda migratsiya
    kerak bo'lardi, yangi jadvalni esa create_all ishga tushishda o'zi yaratadi.
    """

    __tablename__ = "personal_promo_codes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Qancha bonus yechilgani (tarixiy yozuv — keyin narx o'zgarsa ham saqlanadi)
    price_paid: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PromoCodeRedemption(Base):
    """Bitta promokod bitta akkauntdan FAQAT BIR MARTA ishlatilishini belgilaydi.

    (promo_code_id, user_id) unique — DB darajasida ham majburlanadi (himoya qatlami).
    """

    __tablename__ = "promo_code_redemptions"
    __table_args__ = (
        UniqueConstraint("promo_code_id", "user_id", name="uq_promo_user"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    promo_code_id: Mapped[str] = mapped_column(
        ForeignKey("promo_codes.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    redeemed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
