"""Real imtihonga bir martalik pulli kirish (ticket)."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RealExamAccess(Base):
    """Bitta to'langan real imtihon kirishi.

    `purchase` bitta yozuv (used=False) yaratadi; `start_real_exam` uni
    ishlatib (used=True) imtihonni boshlaydi. Har kirish = bitta to'lov.
    """

    __tablename__ = "real_exam_access"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[int] = mapped_column(Integer, default=0)
    method: Mapped[str] = mapped_column(String(32), default="")
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
