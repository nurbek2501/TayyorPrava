"""Question schemas (multilingual)."""
from datetime import datetime
from typing import Optional

from pydantic import Field

from app.schemas.common import CamelModel, LocalizedText


class OptionRead(CamelModel):
    id: str
    text: LocalizedText
    is_correct: bool


class QuestionRead(CamelModel):
    id: str
    topic_id: int
    text: LocalizedText
    image_url: Optional[str] = None
    options: list[OptionRead]
    explanation: Optional[LocalizedText] = None
    created_at: datetime


# --- Mashq (trening) rejimi: TO'G'RI javob va izoh OSHKOR QILINMAYDI ---
class PracticeOptionRead(CamelModel):
    id: str
    text: LocalizedText


class PracticeQuestionRead(CamelModel):
    id: str
    topic_id: int
    text: LocalizedText
    image_url: Optional[str] = None
    options: list[PracticeOptionRead]
    created_at: datetime


class CheckAnswerRequest(CamelModel):
    question_id: str
    option_id: str


class CheckAnswerResponse(CamelModel):
    is_correct: bool
    correct_option_id: Optional[str] = None
    explanation: Optional[LocalizedText] = None


class OptionCreate(CamelModel):
    text: LocalizedText
    is_correct: bool = False


class QuestionCreate(CamelModel):
    topic_id: int
    text: LocalizedText
    explanation: Optional[LocalizedText] = None
    image_url: Optional[str] = None
    options: list[OptionCreate] = Field(min_length=2, max_length=4)


class QuestionUpdate(CamelModel):
    topic_id: Optional[int] = None
    text: Optional[LocalizedText] = None
    explanation: Optional[LocalizedText] = None
    image_url: Optional[str] = None
    options: Optional[list[OptionCreate]] = None


class CheckQuestionRequest(CamelModel):
    text: str


class CheckQuestionResponse(CamelModel):
    exists: bool
    duplicate_text: Optional[str] = None


class TranslateRequest(CamelModel):
    texts: list[str]


class TranslateResponse(CamelModel):
    translations: list[str]
    ok: bool = True


class QuestionListResponse(CamelModel):
    items: list[QuestionRead]
    total: int
    page: int
    page_size: int


class ImageUploadResponse(CamelModel):
    image_url: str


class TicketRead(CamelModel):
    number: int
    count: int
