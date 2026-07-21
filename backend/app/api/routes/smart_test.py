"""Smart test (aqlli test) — o'zlashtirishga asoslangan mashq.

Oqim:
  - /info     — bilmagan/bilgan savollar statistikasi + tavsiya.
  - /start    — N ta tasodifiy (o'zlashtirilmagan) savol beradi.
  - /answer   — javobni tekshiradi, streak ni yangilaydi (mastered bo'lishi mumkin).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.abuse import guard_answer, guard_serve
from app.core.config import settings as app_settings
from app.core.ratelimit import _client_key, limiter, questions_key
from app.crud import questions as questions_crud
from app.crud import settings as settings_crud
from app.crud import smart as smart_crud
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.smart import (
    SmartAnswerRequest,
    SmartAnswerResponse,
    SmartInfoResponse,
    SmartStartRequest,
    SmartStartResponse,
)
from app.services.serializers import (
    correct_option_id,
    serialize_exam_question,
    serialize_question,
)

router = APIRouter(prefix="/smart-test", tags=["smart-test"])


@router.get("/info", response_model=SmartInfoResponse)
async def smart_info(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    settings_row = await settings_crud.get_settings(db)
    attempted, known = await smart_crud.get_progress_counts(db, user.id)
    unknown = max(0, attempted - known)
    unknown_percent = round(unknown / attempted * 100) if attempted else 100
    advice_percent = int(settings_row.smart_test_advice_percent or 50)
    # Bilmaganlar foizi chegaradan PAST bo'lsa (va urinish bo'lsa) — real imtihon tavsiyasi.
    advise = attempted > 0 and unknown_percent < advice_percent
    return SmartInfoResponse(
        streak=int(settings_row.smart_test_streak or 5),
        advice_percent=advice_percent,
        attempted=attempted,
        known=known,
        unknown=unknown,
        unknown_percent=unknown_percent,
        advise=advise,
    )


@router.post("/start", response_model=SmartStartResponse, status_code=201)
@limiter.limit(app_settings.RATE_LIMIT_QUESTIONS, key_func=questions_key)
@limiter.limit(app_settings.RATE_LIMIT_QUESTIONS_IP, key_func=_client_key)
async def smart_start(
    request: Request,
    payload: Optional[SmartStartRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    settings_row = await settings_crud.get_settings(db)
    # Foydalanuvchi savol sonini tanlamaydi — random batch (o'zlashtirilmaganlardan).
    requested = (payload.count if payload else None) or 30
    count = max(1, min(int(requested), 100))
    questions = await smart_crud.pick_pool(db, user.id, count)
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mashq uchun savol qolmadi — barchasini o'zlashtirgansiz!",
        )
    streaks = await smart_crud.get_streaks(db, user.id, [q.id for q in questions])
    out = []
    for q in questions:
        d = serialize_exam_question(q)
        d["streak"] = streaks.get(q.id, 0)
        out.append(d)
    # Hajm anomaliyasi nazorati (rate-limit ustidan qo'shimcha qatlam)
    await guard_serve(user.id, len(questions))
    return SmartStartResponse(
        streak_target=int(settings_row.smart_test_streak or 5),
        questions=out,
    )


@router.post("/answer", response_model=SmartAnswerResponse)
@limiter.limit(app_settings.RATE_LIMIT_ANSWERS, key_func=questions_key)
@limiter.limit(app_settings.RATE_LIMIT_QUESTIONS_IP, key_func=_client_key)
async def smart_answer(
    request: Request,
    payload: SmartAnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question = await questions_crud.get_question(db, payload.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Savol topilmadi")
    settings_row = await settings_crud.get_settings(db)
    target = int(settings_row.smart_test_streak or 5)
    cid = correct_option_id(question)
    is_correct = bool(payload.option_id == cid)
    streak, mastered = await smart_crud.record_answer(
        db, user.id, payload.question_id, is_correct, target
    )
    await db.commit()
    # Javob-kaliti bulk ekstraksiyasi nazorati
    await guard_answer(user.id, payload.question_id)
    return SmartAnswerResponse(
        is_correct=is_correct,
        correct_option_id=cid,
        streak=streak,
        mastered=mastered,
        streak_target=target,
        explanation=serialize_question(question).get("explanation"),
    )
