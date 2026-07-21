"""Exam and Real-exam schemas."""
from typing import Optional

from app.schemas.common import CamelModel, LocalizedText


# ---- Real exam pulli kirish ----
class RealExamInfoResponse(CamelModel):
    price: int
    has_access: bool  # to'langan, lekin hali ishlatilmagan kirish bormi
    bonus: int = 0  # foydalanuvchining promokod bonusi (balans)
    locked: bool = False  # admin butun bo'limni vaqtincha yopgan bo'lsa


class RealExamPurchaseRequest(CamelModel):
    method: Optional[str] = None
    # Ixtiyoriy chegirma promokodi — admin yaratgan (real-exam narxiga foizli chegirma).
    promo_code: Optional[str] = None


class RealExamPurchaseResponse(CamelModel):
    ok: bool = True
    price: int
    discount_percent: int = 0


class RealExamPromoCheckRequest(CamelModel):
    code: str


class RealExamPromoCheckResponse(CamelModel):
    valid: bool
    discount_percent: int = 0
    discounted_price: int = 0
    # Nofaol/aniqlanmagan sabab — masalan "already_used" (frontend alohida xabar ko'rsatishi uchun).
    reason: Optional[str] = None


# ---- Classic exam ----
class ExamStartRequest(CamelModel):
    topic_id: Optional[int] = None
    kind: str = "exam"
    count: Optional[int] = None


class ExamQuestionRead(CamelModel):
    question_id: str
    image_url: Optional[str] = None
    text: LocalizedText
    options: list["ExamOption"]


class ExamOption(CamelModel):
    option_id: str
    text: LocalizedText


class ExamStartResponse(CamelModel):
    session_id: str
    duration_sec: int
    questions: list[ExamQuestionRead]


class ExamAnswerItem(CamelModel):
    question_id: str
    option_id: Optional[str] = None


class ExamSubmitRequest(CamelModel):
    answers: list[ExamAnswerItem]


class ExamResultItem(CamelModel):
    question_id: str
    selected_option_id: Optional[str] = None
    correct_option_id: str
    is_correct: bool


class ExamResultResponse(CamelModel):
    session_id: str
    total: int
    correct: int
    mistakes: int
    passed: bool
    results: list[ExamResultItem]


# ---- Real exam (3 languages, no correct answer sent) ----
class RealExamStartRequest(CamelModel):
    # 20 — birinchi marta topshirayotganlar; 50 — guvohnomadan mahrum bo'lganlar.
    count: Optional[int] = None


class RealExamOption(CamelModel):
    option_id: str
    text: LocalizedText


class RealExamQuestionRead(CamelModel):
    question_id: str
    image_url: Optional[str] = None
    text: LocalizedText
    options: list[RealExamOption]


class RealExamStartResponse(CamelModel):
    session_id: str
    duration_sec: int
    pass_max_mistakes: int
    questions: list[RealExamQuestionRead]


class RealExamAnswerRequest(CamelModel):
    question_id: str
    option_id: str


class RealExamResultItem(CamelModel):
    question_id: str
    selected_option_id: Optional[str] = None
    correct_option_id: str
    is_correct: bool


class RealExamFinishResponse(CamelModel):
    session_id: str
    total: int
    correct: int
    mistakes: int
    passed: bool
    results: list[RealExamResultItem]


ExamQuestionRead.model_rebuild()
