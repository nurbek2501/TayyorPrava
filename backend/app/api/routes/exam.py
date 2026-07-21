"""Classic exam + real-exam routes."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.ratelimit import limiter, questions_key
from app.crud import exam_access as exam_access_crud
from app.crud import payments as payments_crud
from app.crud import promo as promo_crud
from app.crud import settings as settings_crud
from app.db.session import get_db
from app.deps import get_current_user
from app.models.enums import ExamStatus, PaymentStatus
from app.models.user import User
from app.schemas.exam import (
    ExamResultResponse,
    ExamStartRequest,
    ExamStartResponse,
    ExamSubmitRequest,
    RealExamAnswerRequest,
    RealExamFinishResponse,
    RealExamInfoResponse,
    RealExamPromoCheckRequest,
    RealExamPromoCheckResponse,
    RealExamPurchaseRequest,
    RealExamPurchaseResponse,
    RealExamStartRequest,
    RealExamStartResponse,
)
from app.services import exam_service
from app.services.serializers import serialize_exam_question

router = APIRouter(tags=["exam"])


def _apply_discount(price: int, discount_percent: int) -> int:
    return max(0, round(price * (100 - discount_percent) / 100))


# ---------------- Classic exam ----------------
@router.post("/exam/start", response_model=ExamStartResponse, status_code=201)
@limiter.limit(settings.RATE_LIMIT_ANSWERS, key_func=questions_key)
async def start_exam(
    request: Request,
    payload: ExamStartRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    settings_row = await settings_crud.get_settings(db)
    session, questions, duration = await exam_service.start_exam(
        db, user, settings_row, topic_id=payload.topic_id, count=payload.count,
        kind=payload.kind,
    )
    await db.commit()
    return {
        "sessionId": session.id,
        "durationSec": duration,
        "questions": [serialize_exam_question(q) for q in questions],
    }


@router.post("/exam/{session_id}/submit", response_model=ExamResultResponse)
@limiter.limit(settings.RATE_LIMIT_ANSWERS, key_func=questions_key)
async def submit_exam(
    request: Request,
    session_id: str,
    payload: ExamSubmitRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = await exam_service.get_exam_session(db, session_id, user.id)
    if session is None:
        raise HTTPException(status_code=404, detail="Imtihon sessiyasi topilmadi")
    if session.status == ExamStatus.finished:
        raise HTTPException(status_code=409, detail="Imtihon allaqachon yakunlangan")
    settings_row = await settings_crud.get_settings(db)
    result = await exam_service.submit_exam(
        db, session, user, settings_row,
        [a.model_dump() for a in payload.answers],
    )
    await db.commit()
    return result


# ---------------- Real exam (3 languages) ----------------
@router.get("/real-exam/info", response_model=RealExamInfoResponse)
async def real_exam_info(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Real imtihon narxi va to'langan (ishlatilmagan) kirish bor-yo'qligi."""
    settings_row = await settings_crud.get_settings(db)
    has = await exam_access_crud.has_unused(db, user.id)
    await db.commit()
    return RealExamInfoResponse(
        price=settings_row.real_exam_price,
        has_access=has,
        bonus=int(user.bonus_balance or 0),
        locked=bool(settings_row.real_exam_locked),
    )


@router.post("/real-exam/check-promo", response_model=RealExamPromoCheckResponse)
async def check_real_exam_promo(
    payload: RealExamPromoCheckRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Chegirma promokodini tekshiradi — to'lovdan oldin chegirmali narxni ko'rsatish uchun."""
    settings_row = await settings_crud.get_settings(db)
    promo = await promo_crud.get_active_by_code(db, payload.code)
    if promo is None:
        return RealExamPromoCheckResponse(valid=False)
    if await promo_crud.has_user_redeemed(db, promo.id, user.id):
        return RealExamPromoCheckResponse(valid=False, reason="already_used")
    return RealExamPromoCheckResponse(
        valid=True,
        discount_percent=promo.discount_percent,
        discounted_price=_apply_discount(settings_row.real_exam_price, promo.discount_percent),
    )


@router.post(
    "/real-exam/purchase", response_model=RealExamPurchaseResponse, status_code=201
)
async def purchase_real_exam(
    payload: Optional[RealExamPurchaseRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Bir martalik real imtihon kirishini sotib olish (darhol ochiladi).

    Haqiqiy to'lov shlyuzi (Click/Payme) keyin shu yerga ulanadi.
    """
    settings_row = await settings_crud.get_settings(db)
    if settings_row.real_exam_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Real imtihon bo'limi vaqtincha yopiq",
        )
    price = settings_row.real_exam_price
    method = (payload.method if payload else None) or "demo"

    # Chegirma promokodi — berilgan bo'lsa va faol bo'lsa narxni kamaytiradi.
    # Promokodsiz oqim OLDINGIDEK ishlaydi (discount_percent=0 -> price o'zgarmaydi).
    discount_percent = 0
    promo = None
    promo_code = payload.promo_code if payload else None
    if promo_code:
        promo = await promo_crud.get_active_by_code(db, promo_code)
        if promo is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Promokod noto'g'ri yoki faol emas",
            )
        if await promo_crud.has_user_redeemed(db, promo.id, user.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Siz bu promokoddan allaqachon foydalangansiz",
            )
        discount_percent = promo.discount_percent
        price = _apply_discount(price, discount_percent)

    if method == "bonus":
        # Bonus bilan: balansdan yechiladi (daromad emas — to'lov yozuvi yo'q).
        if int(user.bonus_balance or 0) < price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bonus yetarli emas",
            )
        user.bonus_balance = int(user.bonus_balance or 0) - price
    else:
        # Haqiqiy to'lov yozuvi (admin ko'rishi + daromad statistikasi) — darhol "paid"
        payment = await payments_crud.create_payment(
            db, user_id=user.id, tariff_id=None, method=method, phone="",
            amount=price, category="real_exam",
        )
        await payments_crud.update_payment_status(db, payment, PaymentStatus.paid)

    if promo is not None:
        await promo_crud.increment_usage(db, promo)
        await promo_crud.record_redemption(db, promo.id, user.id)

    # Bitta kirish ticketi (start_real_exam uni ishlatadi)
    await exam_access_crud.create_access(
        db, user_id=user.id, amount=price, method=method
    )
    await db.commit()
    return RealExamPurchaseResponse(ok=True, price=price, discount_percent=discount_percent)


@router.post("/real-exam/start", response_model=RealExamStartResponse, status_code=201)
async def start_real_exam(
    payload: Optional[RealExamStartRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    settings_row = await settings_crud.get_settings(db)
    if settings_row.real_exam_locked:
        # Bo'lim yopiq bo'lsa, avvaldan to'langan (ishlatilmagan) ticket bo'lsa ham
        # HECH KIM boshlay olmaydi — "hech kim kira olmasin" talabiga mos.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Real imtihon bo'limi vaqtincha yopiq",
        )
    # Pulli kirish: to'langan (ishlatilmagan) ticket bo'lishi shart
    access = await exam_access_crud.get_unused_access(db, user.id)
    if access is None:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Real imtihonga kirish uchun to'lov qiling",
        )
    count = payload.count if payload else None
    session, questions = await exam_service.start_real_exam(
        db, user, settings_row, count=count
    )
    if not questions:
        raise HTTPException(
            status_code=409,
            detail="Bazada yetarli savol yo'q. Avval admin paneldan savol qo'shing.",
        )
    # Imtihon boshlandi — ticketni ishlatamiz
    await exam_access_crud.consume_access(db, access)
    await db.commit()
    return {
        "sessionId": session.id,
        "durationSec": session.duration_sec,
        "passMaxMistakes": session.pass_max_mistakes,
        "questions": [serialize_exam_question(q) for q in questions],
    }


@router.post("/real-exam/{session_id}/answer")
async def answer_real_exam(
    session_id: str,
    payload: RealExamAnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = await exam_service.get_real_session(db, session_id, user.id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessiya topilmadi")
    if session.status == ExamStatus.finished:
        raise HTTPException(status_code=409, detail="Imtihon yakunlangan")
    feedback = await exam_service.answer_real_exam(
        db, session, payload.question_id, payload.option_id
    )
    if feedback is None:
        raise HTTPException(status_code=400, detail="Savol bu sessiyaga tegishli emas")
    await db.commit()
    return {"success": True, **feedback}


@router.post("/real-exam/{session_id}/finish", response_model=RealExamFinishResponse)
async def finish_real_exam(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = await exam_service.get_real_session(db, session_id, user.id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessiya topilmadi")
    result = await exam_service.finish_real_exam(db, session, user)
    await db.commit()
    return result
