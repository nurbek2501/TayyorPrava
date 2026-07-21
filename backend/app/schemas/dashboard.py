"""Admin dashboard schemas."""
from app.schemas.common import CamelModel


class DashboardSummary(CamelModel):
    total_questions: int
    total_users: int
    active_subscriptions: int
    today_payments: int
    total_revenue: int
    referral_signups: int
    new_users_today: int
    exams_today: int
    exams_total: int
    avg_exam_score: float
    pass_rate: float
    # Yangi: real imtihon pulli kirish + telegram bog'lanish
    real_exam_revenue: int = 0
    real_exam_entries: int = 0
    telegram_bound: int = 0


class TimeseriesPoint(CamelModel):
    date: str
    registrations: int
    payments: int
    revenue: int


class TimeseriesResponse(CamelModel):
    range: str
    points: list[TimeseriesPoint]


class TopicDistributionItem(CamelModel):
    topic_id: int
    name: str
    count: int


class TopicDistributionResponse(CamelModel):
    items: list[TopicDistributionItem]


class PassRateResponse(CamelModel):
    passed: int
    failed: int


class MeStats(CamelModel):
    favorites: int
    mistakes: int
    all_mistakes_percent: float


class ReferralStats(CamelModel):
    bonus: int
    invited: int
    paid: int
    ref_code: str
    ref_link: str
