"""Smart test (aqlli test) repository — o'zlashtirish (streak/mastered)."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.models.smart import SmartProgress


async def get_progress_counts(db: AsyncSession, user_id: str) -> tuple[int, int]:
    """(attempted, mastered) — urinilgan va o'zlashtirilgan savollar soni."""
    attempted = (
        await db.execute(
            select(func.count())
            .select_from(SmartProgress)
            .where(SmartProgress.user_id == user_id)
        )
    ).scalar_one() or 0
    mastered = (
        await db.execute(
            select(func.count())
            .select_from(SmartProgress)
            .where(
                SmartProgress.user_id == user_id, SmartProgress.mastered.is_(True)
            )
        )
    ).scalar_one() or 0
    return int(attempted), int(mastered)


async def get_streaks(
    db: AsyncSession, user_id: str, ids: list[str]
) -> dict[str, int]:
    """{question_id: streak} — berilgan savollar bo'yicha joriy ketma-ketlik."""
    if not ids:
        return {}
    res = await db.execute(
        select(SmartProgress.question_id, SmartProgress.streak).where(
            SmartProgress.user_id == user_id,
            SmartProgress.question_id.in_(ids),
        )
    )
    return {qid: int(streak) for qid, streak in res.all()}


async def pick_pool(db: AsyncSession, user_id: str, count: int) -> list[Question]:
    """N ta tasodifiy savol — o'zlashtirilganlari (mastered) chiqarib tashlanadi."""
    mastered_q = select(SmartProgress.question_id).where(
        SmartProgress.user_id == user_id, SmartProgress.mastered.is_(True)
    )
    stmt = (
        select(Question)
        .where(Question.id.notin_(mastered_q))
        .order_by(func.random())
        .limit(count)
    )
    return list((await db.execute(stmt)).scalars().all())


async def record_answer(
    db: AsyncSession,
    user_id: str,
    question_id: str,
    is_correct: bool,
    streak_target: int,
) -> tuple[int, bool]:
    """Javobni yozadi: to'g'ri -> streak+1 (chegaraga yetsa mastered), xato -> 0.

    (streak, mastered) qaytaradi.
    """
    res = await db.execute(
        select(SmartProgress).where(
            SmartProgress.user_id == user_id,
            SmartProgress.question_id == question_id,
        )
    )
    row = res.scalar_one_or_none()
    if row is None:
        row = SmartProgress(
            user_id=user_id, question_id=question_id, streak=0, mastered=False
        )
        db.add(row)

    if is_correct:
        row.streak += 1
        if row.streak >= max(1, streak_target):
            row.mastered = True
    else:
        row.streak = 0
        row.mastered = False

    await db.flush()
    return int(row.streak), bool(row.mastered)
