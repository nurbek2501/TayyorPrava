"""Topic model (42 PDD topics)."""
from typing import TYPE_CHECKING, List

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:  # faqat tip-tekshiruv uchun (runtime'da SQLAlchemy registry hal qiladi)
    from app.models.question import Question


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(primary_key=True)  # 1..42
    name_uz: Mapped[str] = mapped_column(String(255))
    name_kaa: Mapped[str] = mapped_column(String(255), default="")
    name_ru: Mapped[str] = mapped_column(String(255), default="")
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # cascade + passive_deletes: topic o'chirilsa savollari ham o'chadi (DB'da ondelete=CASCADE).
    # Busiz ORM topic_id=NULL qilishga urinadi -> NOT NULL buziladi -> har topic o'chirish 500 beradi.
    questions: Mapped[List["Question"]] = relationship(
        back_populates="topic", cascade="all, delete-orphan", passive_deletes=True
    )
