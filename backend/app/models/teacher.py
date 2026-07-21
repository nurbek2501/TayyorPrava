"""Ustoz (maslahat) tizimi modellari.

- TeacherProfile — ustozning qo'shimcha ma'lumotlari (User role=teacher bilan 1:1)
- TeacherTariff  — ustozga murojaat narxlari (kun soni + narx, admin belgilaydi)
- TeacherAccess  — user'ning ustozga to'langan kirishi (muddatli)
- ChatThread     — user↔ustoz suhbati (navbat: eng eski javobsiz birinchi)
- ChatMessage    — telegram-uslub xabar (matn / rasm / fayl / link)
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    # Necha yillik tajriba — user tomonda ko'rinadi, narxlar shunga qarab qo'yiladi
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    tariffs: Mapped[list["TeacherTariff"]] = relationship(
        back_populates="teacher", cascade="all, delete-orphan",
        order_by="TeacherTariff.days",
    )


class TeacherTariff(Base):
    """Ustozga murojaat tarifi: N kun = X so'm (har ustozga alohida, admin qo'yadi)."""

    __tablename__ = "teacher_tariffs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    teacher_id: Mapped[str] = mapped_column(
        ForeignKey("teacher_profiles.id", ondelete="CASCADE"), index=True
    )
    days: Mapped[int] = mapped_column(Integer)  # kirish muddati (kun)
    price: Mapped[int] = mapped_column(Integer)  # so'm
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    teacher: Mapped["TeacherProfile"] = relationship(back_populates="tariffs")


class TeacherAccess(Base):
    """User'ning ustozga to'langan kirishi — muddat tugaguncha yozisha oladi."""

    __tablename__ = "teacher_access"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    teacher_id: Mapped[str] = mapped_column(
        ForeignKey("teacher_profiles.id", ondelete="CASCADE"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ChatThread(Base):
    """Bitta user↔ustoz suhbati (telegram'dagi dialog kabi)."""

    __tablename__ = "chat_threads"
    __table_args__ = (
        UniqueConstraint("user_id", "teacher_id", name="uq_thread_user_teacher"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    teacher_id: Mapped[str] = mapped_column(
        ForeignKey("teacher_profiles.id", ondelete="CASCADE"), index=True
    )
    # Navbat mantiqi: user yozgan-u ustoz hali javob bermagan bo'lsa True.
    # awaiting_since — birinchi javobsiz xabar vaqti (eng eskisi navbatda birinchi).
    awaiting_reply: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    awaiting_since: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_msg_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="thread", cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    thread_id: Mapped[str] = mapped_column(
        ForeignKey("chat_threads.id", ondelete="CASCADE"), index=True
    )
    sender: Mapped[str] = mapped_column(String(16))  # "user" | "teacher"
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Biriktirma: /static/... URL; type — "image" | "file"
    attachment_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    attachment_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    attachment_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    # Shubhali kontent (link / telefon / fayl / rasm) — admin ogohlantirishlar ro'yxatida chiqadi
    has_link: Mapped[bool] = mapped_column(Boolean, default=False)
    # Matnda telefon raqami aniqlansa (platformadan tashqari aloqaga urinish belgisi)
    has_phone: Mapped[bool] = mapped_column(Boolean, default=False)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    # Tahrirlangan vaqti (telegram'dagi "edited" kabi)
    edited_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Soft-delete: user/ustoz ko'rmaydi, admin "o'chirilgan" belgisi bilan ko'radi
    # (moderatsiya dalili yo'qolmasin).
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    thread: Mapped["ChatThread"] = relationship(back_populates="messages")
