"""Exam and Real-exam sessions + answers."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ExamStatus


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(32), default="exam")
    total: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[ExamStatus] = mapped_column(
        Enum(ExamStatus), default=ExamStatus.in_progress, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    answers: Mapped[list["ExamAnswer"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class ExamAnswer(Base):
    __tablename__ = "exam_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("exam_sessions.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE")
    )
    selected_option_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    session: Mapped["ExamSession"] = relationship(back_populates="answers")


class RealExamSession(Base):
    __tablename__ = "real_exam_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(8), default="uz")
    total: Mapped[int] = mapped_column(Integer, default=20)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    mistakes: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    pass_max_mistakes: Mapped[int] = mapped_column(Integer, default=2)
    duration_sec: Mapped[int] = mapped_column(Integer, default=1500)
    status: Mapped[ExamStatus] = mapped_column(
        Enum(ExamStatus), default=ExamStatus.in_progress, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    answers: Mapped[list["RealExamAnswer"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="RealExamAnswer.order_index",
    )


class RealExamAnswer(Base):
    __tablename__ = "real_exam_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("real_exam_sessions.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE")
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    selected_option_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    session: Mapped["RealExamSession"] = relationship(back_populates="answers")
