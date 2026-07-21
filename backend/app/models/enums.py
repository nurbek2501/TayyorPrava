"""Shared enums used across models and schemas."""
import enum


class Lang(str, enum.Enum):
    kaa = "kaa"  # Qoraqalpoqcha
    uz = "uz"    # O'zbekcha
    ru = "ru"    # Русский


class Role(str, enum.Enum):
    user = "user"
    admin = "admin"
    teacher = "teacher"  # ustoz — maslahat paneli


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    cancelled = "cancelled"


class ExamStatus(str, enum.Enum):
    in_progress = "in_progress"
    finished = "finished"
