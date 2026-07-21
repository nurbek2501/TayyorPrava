"""Import all models so SQLAlchemy's metadata is fully populated."""
from app.models.auth_code import AuthCode, PendingRegistration
from app.models.enums import ExamStatus, Lang, PaymentStatus, Role
from app.models.exam_access import RealExamAccess
from app.models.exam import (
    ExamAnswer,
    ExamSession,
    RealExamAnswer,
    RealExamSession,
)
from app.models.question import (
    Option,
    OptionTranslation,
    Question,
    QuestionTranslation,
    UserFavorite,
    UserMistake,
)
from app.models.promo import PromoCode, PromoCodeRedemption
from app.models.settings import Settings
from app.models.smart import SmartProgress
from app.models.tariff import Payment, PaymentMethod, Tariff
from app.models.teacher import (
    ChatMessage,
    ChatThread,
    TeacherAccess,
    TeacherProfile,
    TeacherTariff,
)
from app.models.topic import Topic
from app.models.user import Referral, Subscription, User

__all__ = [
    "Lang",
    "Role",
    "PaymentStatus",
    "ExamStatus",
    "Topic",
    "Question",
    "QuestionTranslation",
    "Option",
    "OptionTranslation",
    "UserMistake",
    "UserFavorite",
    "User",
    "Subscription",
    "Referral",
    "Tariff",
    "PaymentMethod",
    "Payment",
    "ExamSession",
    "ExamAnswer",
    "RealExamSession",
    "RealExamAnswer",
    "Settings",
    "PendingRegistration",
    "AuthCode",
    "RealExamAccess",
    "SmartProgress",
    "TeacherProfile",
    "TeacherTariff",
    "TeacherAccess",
    "ChatThread",
    "ChatMessage",
    "PromoCode",
    "PromoCodeRedemption",
]
