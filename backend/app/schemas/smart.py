"""Smart test (aqlli test) schemas."""
from typing import Optional

from app.schemas.common import CamelModel, LocalizedText
from app.schemas.exam import RealExamQuestionRead


class SmartInfoResponse(CamelModel):
    streak: int  # ketma-ketlik chegarasi (admin)
    advice_percent: int  # tavsiya foizi chegarasi (admin)
    attempted: int  # urinilgan savollar
    known: int  # o'zlashtirilgan (mastered)
    unknown: int  # bilmagan (urinilgan, lekin o'zlashtirilmagan)
    unknown_percent: int  # bilmaganlar foizi (urinilganlarga nisbatan)
    advise: bool  # real imtihon tavsiya etilsinmi


class SmartStartRequest(CamelModel):
    count: Optional[int] = None


class SmartPoolQuestion(RealExamQuestionRead):
    streak: int = 0  # foydalanuvchining shu savol bo'yicha joriy ketma-ketligi


class SmartStartResponse(CamelModel):
    streak_target: int
    questions: list[SmartPoolQuestion]


class SmartAnswerRequest(CamelModel):
    question_id: str
    option_id: str


class SmartAnswerResponse(CamelModel):
    is_correct: bool
    correct_option_id: Optional[str] = None
    streak: int
    mastered: bool
    streak_target: int
    explanation: Optional[LocalizedText] = None
