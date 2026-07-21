"""Site settings schemas."""
from typing import Optional

from app.schemas.common import CamelModel


class SettingsRead(CamelModel):
    site_name: str
    default_lang: str
    default_theme: str
    exam_question_count: int
    exam_duration_min: int
    exam_max_mistakes: int
    real_exam_question_count: int
    real_exam_duration_min: int
    real_exam_max_mistakes: int
    real_exam_restore_max_mistakes: int
    real_exam_price: int
    real_exam_locked: bool
    referral_bonus: int
    smart_test_streak: int
    smart_test_advice_percent: int
    landing_badge: str
    landing_title: str
    landing_subtitle: str
    landing_cta: str
    landing_telegram: str
    landing_phone: str


class SettingsUpdate(CamelModel):
    site_name: Optional[str] = None
    default_lang: Optional[str] = None
    default_theme: Optional[str] = None
    exam_question_count: Optional[int] = None
    exam_duration_min: Optional[int] = None
    exam_max_mistakes: Optional[int] = None
    real_exam_question_count: Optional[int] = None
    real_exam_duration_min: Optional[int] = None
    real_exam_max_mistakes: Optional[int] = None
    real_exam_restore_max_mistakes: Optional[int] = None
    real_exam_price: Optional[int] = None
    real_exam_locked: Optional[bool] = None
    referral_bonus: Optional[int] = None
    smart_test_streak: Optional[int] = None
    smart_test_advice_percent: Optional[int] = None
    landing_badge: Optional[str] = None
    landing_title: Optional[str] = None
    landing_subtitle: Optional[str] = None
    landing_cta: Optional[str] = None
    landing_telegram: Optional[str] = None
    landing_phone: Optional[str] = None


# ---- Public landing (mehmon paneli) ----
class LandingStats(CamelModel):
    questions: int
    users: int
    exams: int
    pass_rate: float


class LandingRead(CamelModel):
    site_name: str
    badge: str
    title: str
    subtitle: str
    cta: str
    telegram: str
    phone: str
    stats: LandingStats
