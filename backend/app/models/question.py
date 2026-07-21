"""Question + multilingual translations + options."""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import Lang

if TYPE_CHECKING:  # faqat tip-tekshiruv uchun (runtime'da SQLAlchemy registry hal qiladi)
    from app.models.topic import Topic


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    topic_id: Mapped[int] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), index=True
    )
    ticket_number: Mapped[int] = mapped_column(Integer, default=0, index=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    image_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # lazy (default) — bu relationship hech qayerda o'qilmaydi; eager (selectin) har savol
    # yuklashda keraksiz "SELECT ... FROM topics" qo'shardi. Serializerlar faqat topic_id ishlatadi.
    topic: Mapped["Topic"] = relationship(back_populates="questions")
    translations: Mapped[List["QuestionTranslation"]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    options: Mapped[List["Option"]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="Option.order_index",
        lazy="selectin",
    )


class QuestionTranslation(Base):
    __tablename__ = "question_translations"
    __table_args__ = (
        UniqueConstraint("question_id", "lang", name="uq_qtr_question_lang"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[Lang] = mapped_column(Enum(Lang))
    text: Mapped[str] = mapped_column(Text)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    question: Mapped["Question"] = relationship(back_populates="translations")


class Option(Base):
    __tablename__ = "options"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )  # optionId — stable, language-independent
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    question: Mapped["Question"] = relationship(back_populates="options")
    translations: Mapped[List["OptionTranslation"]] = relationship(
        back_populates="option",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class OptionTranslation(Base):
    __tablename__ = "option_translations"
    __table_args__ = (
        UniqueConstraint("option_id", "lang", name="uq_otr_option_lang"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    option_id: Mapped[str] = mapped_column(
        ForeignKey("options.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[Lang] = mapped_column(Enum(Lang))
    text: Mapped[str] = mapped_column(Text)

    option: Mapped["Option"] = relationship(back_populates="translations")


class UserMistake(Base):
    __tablename__ = "user_mistakes"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_mistake_user_q"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class UserFavorite(Base):
    __tablename__ = "user_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_fav_user_q"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
