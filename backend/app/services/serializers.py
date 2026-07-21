"""Convert ORM objects into camelCase dicts matching the API schemas."""
from __future__ import annotations

import random
from typing import Iterable, Optional

from app.core.config import settings
from app.models.question import Option, Question
from app.models.tariff import Payment, PaymentMethod, Tariff
from app.models.user import User


def _lang_value(lang) -> str:
    return lang.value if hasattr(lang, "value") else str(lang)


def _localized(translations: Iterable, attr: str = "text") -> dict:
    out = {"kaa": "", "uz": "", "ru": ""}
    for tr in translations:
        out[_lang_value(tr.lang)] = getattr(tr, attr) or ""
    return out


def serialize_option(opt: Option, *, with_correct: bool = True) -> dict:
    data = {
        "id": opt.id,
        "optionId": opt.id,
        "text": _localized(opt.translations),
    }
    if with_correct:
        data["isCorrect"] = opt.is_correct
    return data


def serialize_question(q: Question) -> dict:
    """Full question incl. correct flags + explanation (admin / practice detail)."""
    expl = _localized(q.translations, "explanation")
    explanation = expl if any(v for v in expl.values()) else None
    return {
        "id": q.id,
        "topicId": q.topic_id,
        "text": _localized(q.translations, "text"),
        "imageUrl": q.image_url,
        "options": [serialize_option(o, with_correct=True) for o in q.options],
        "explanation": explanation,
        "createdAt": q.created_at,
    }


def question_explanation(q: Question) -> Optional[dict]:
    """Savol izohi (3 tilli) — bo'sh bo'lsa None."""
    expl = _localized(q.translations, "explanation")
    return expl if any(v for v in expl.values()) else None


def serialize_practice_question(q: Question) -> dict:
    """Mashq (trening) uchun savol — TO'G'RI javob va izoh BERILMAYDI.

    To'g'ri javob/izoh faqat foydalanuvchi tanlagandan keyin /check-answer orqali keladi.
    """
    options = [{"id": o.id, "text": _localized(o.translations)} for o in q.options]
    if settings.SHUFFLE_OPTIONS:
        # Tartibni aralashtiramiz (ID'lar uuid — o'zgarmaydi; tekshiruv ID bo'yicha).
        random.shuffle(options)
    return {
        "id": q.id,
        "topicId": q.topic_id,
        "text": _localized(q.translations, "text"),
        "imageUrl": q.image_url,
        "options": options,
        "createdAt": q.created_at,
    }


def serialize_exam_question(q: Question) -> dict:
    """Question for exam/real-exam — NO correct answer leaked."""
    return {
        "questionId": q.id,
        "imageUrl": q.image_url,
        "text": _localized(q.translations, "text"),
        "options": [
            {"optionId": o.id, "text": _localized(o.translations)} for o in q.options
        ],
    }


def correct_option_id(q: Question) -> Optional[str]:
    for o in q.options:
        if o.is_correct:
            return o.id
    return None


def serialize_user(
    user: User,
    *,
    subscription_active: bool = False,
    subscription_expires_at=None,
) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "surname": user.surname,
        "nickname": user.nickname,
        "phone": user.phone,
        "email": user.email,
        "telegram": user.telegram,
        "telegramId": user.telegram_id,
        "avatarUrl": user.avatar_url,
        "role": _lang_value(user.role),
        "isBlocked": user.is_blocked,
        "blockReason": user.block_reason,
        "blockedAt": user.blocked_at,
        "blockUntil": user.block_until,
        "blockCount": user.block_count,
        "refCode": user.ref_code,
        "createdAt": user.created_at,
        "subscriptionActive": subscription_active,
        "subscriptionExpiresAt": subscription_expires_at,
    }


def serialize_tariff(t: Tariff) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "durationDays": t.duration_days,
        "price": t.price,
        "type": t.type,
        "isActive": t.is_active,
        "orderIndex": t.order_index,
    }


def serialize_payment_method(m: PaymentMethod) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "code": m.code,
        "logoUrl": m.logo_url,
        "isEnabled": m.is_enabled,
        "orderIndex": m.order_index,
    }


def serialize_payment(
    p: Payment,
    *,
    user_name: Optional[str] = None,
    user_nickname: Optional[str] = None,
    tariff_title: Optional[str] = None,
) -> dict:
    return {
        "id": p.id,
        "userId": p.user_id,
        "userName": user_name,
        "userNickname": user_nickname,
        "tariffId": p.tariff_id,
        "tariffTitle": tariff_title,
        "method": p.method,
        "phone": p.phone,
        "amount": p.amount,
        "status": _lang_value(p.status),
        "createdAt": p.created_at,
    }
