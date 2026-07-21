"""Smart test (aqlli test) — foydalanuvchining har bir savol bo'yicha o'zlashtirishi.

`streak` — ketma-ket to'g'ri javoblar soni (xato javob 0 ga tushiradi).
`mastered` — streak admin belgilagan chegaraga yetganda True (savol qayta tushmaydi).
"""
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


class SmartProgress(Base):
    __tablename__ = "smart_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_smart_user_question"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    streak: Mapped[int] = mapped_column(Integer, default=0)
    mastered: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
