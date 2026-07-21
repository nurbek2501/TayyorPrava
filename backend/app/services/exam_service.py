"""Exam & real-exam business logic."""
from __future__ import annotations

import math
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import interactions as interactions_crud
from app.crud import questions as questions_crud
from app.models.enums import ExamStatus
from app.models.exam import (
    ExamAnswer,
    ExamSession,
    RealExamAnswer,
    RealExamSession,
)
from app.models.question import Question
from app.models.settings import Settings
from app.models.user import User
from app.services.serializers import correct_option_id


def _now() -> datetime:
    return datetime.now(timezone.utc)


# «Guvohnomadan mahrum bo'lganlar» (qayta topshirish) rejimidagi savol soni.
# Frontend MODE_CFG.restore.count bilan bir xil bo'lishi shart.
RESTORE_QUESTION_COUNT = 50


# ---------------- Real exam ----------------
async def start_real_exam(
    db: AsyncSession, user: User, settings_row: Settings, *, count: int | None = None
) -> tuple[RealExamSession, list[Question]]:
    # Tanlangan turga qarab savol soni: 20 (birinchi marta) yoki 50 (mahrum etilganlar).
    base_count = settings_row.real_exam_question_count or 20

    # XAVFSIZLIK: mijoz yuborgan `count` — erkin son EMAS, faqat REJIM TANLAGICH.
    # Avval savol soni erkin qabul qilinar va rejim QAYTGAN savol soni (n) bo'yicha
    # aniqlanardi. Bu ikki teshik ochardi:
    #   1) count=21 yuborilsa n != base_count bo'lib, yumshoqroq "qayta topshirish"
    #      chegarasi (4 xato) 21 savolli imtihonga qo'llanardi (o'rniga 2 bo'lishi kerak).
    #   2) Bazada savol kam bo'lsa (masalan 20 ta), count=50 so'ralganda ham n == base_count
    #      chiqib, qattiqroq chegara noto'g'ri qo'llanardi.
    # Endi rejim SERVERDA aniqlanadi va xato chegarasi n ga BOG'LIQ EMAS.
    restore_mode = count is not None and int(count) > int(base_count)
    requested = RESTORE_QUESTION_COUNT if restore_mode else int(base_count)

    questions = await questions_crud.get_random_questions(db, requested)
    n = len(questions)

    base_min = settings_row.real_exam_duration_min or 25
    # Vaqt savol soniga mutanosib (sozlamadagi nisbat saqlanadi).
    duration_min = math.ceil(base_min * n / base_count) if base_count else base_min
    # Ruxsat etilgan xato soni — ikki rejim MUSTAQIL sozlanadi (proportsional
    # hisoblanMAYDI). Rejim yuqorida serverda aniqlangan (mijoz ta'sir qila olmaydi).
    if restore_mode:
        max_mistakes = (
            settings_row.real_exam_restore_max_mistakes
            if settings_row.real_exam_restore_max_mistakes is not None
            else 4
        )
    else:
        max_mistakes = (
            settings_row.real_exam_max_mistakes
            if settings_row.real_exam_max_mistakes is not None
            else 2
        )
    max_mistakes = max(1, int(max_mistakes))

    session = RealExamSession(
        user_id=user.id,
        lang=settings_row.default_lang or "uz",
        total=n,
        pass_max_mistakes=max_mistakes,
        duration_sec=duration_min * 60,
    )
    db.add(session)
    await db.flush()
    for i, q in enumerate(questions):
        db.add(
            RealExamAnswer(session_id=session.id, question_id=q.id, order_index=i)
        )
    await db.flush()
    return session, questions


async def get_real_session(
    db: AsyncSession, session_id: str, user_id: str
) -> RealExamSession | None:
    res = await db.execute(
        select(RealExamSession).where(
            RealExamSession.id == session_id, RealExamSession.user_id == user_id
        )
    )
    return res.scalar_one_or_none()


async def answer_real_exam(
    db: AsyncSession, session: RealExamSession, question_id: str, option_id: str
) -> dict | None:
    res = await db.execute(
        select(RealExamAnswer).where(
            RealExamAnswer.session_id == session.id,
            RealExamAnswer.question_id == question_id,
        )
    )
    ans = res.scalar_one_or_none()
    if ans is None:
        return None
    question = await questions_crud.get_question(db, question_id)
    cid = correct_option_id(question) if question else None
    if ans.confirmed:
        # Tasdiqlangan javobni O'ZGARTIRIB BO'LMAYDI — aks holda to'g'ri javobni ko'rib,
        # qayta yuborib 100% olish mumkin edi. Birinchi javob saqlanadi.
        return {"isCorrect": ans.is_correct, "correctOptionId": cid, "locked": True}
    ans.selected_option_id = option_id
    ans.confirmed = True
    ans.is_correct = bool(option_id == cid)
    await db.flush()
    # Return immediate feedback so the client can show green/red at once.
    return {"isCorrect": ans.is_correct, "correctOptionId": cid}


async def finish_real_exam(
    db: AsyncSession, session: RealExamSession, user: User
) -> dict:
    res = await db.execute(
        select(RealExamAnswer)
        .where(RealExamAnswer.session_id == session.id)
        .order_by(RealExamAnswer.order_index)
    )
    answers = list(res.scalars().all())
    questions = await questions_crud.get_questions_by_ids(
        db, [a.question_id for a in answers]
    )
    qmap = {q.id: q for q in questions}

    results = []
    correct = 0
    for a in answers:
        q = qmap.get(a.question_id)
        cid = correct_option_id(q) if q else None
        is_corr = bool(a.selected_option_id and a.selected_option_id == cid)
        a.is_correct = is_corr
        if is_corr:
            correct += 1
        else:
            await interactions_crud.add_mistake(db, user.id, a.question_id)
        results.append(
            {
                "questionId": a.question_id,
                "selectedOptionId": a.selected_option_id,
                "correctOptionId": cid,
                "isCorrect": is_corr,
            }
        )

    total = len(answers)
    mistakes = total - correct
    passed = mistakes <= (session.pass_max_mistakes or 2)
    session.correct = correct
    session.mistakes = mistakes
    session.passed = passed
    session.status = ExamStatus.finished
    session.finished_at = _now()
    await db.flush()
    return {
        "sessionId": session.id,
        "total": total,
        "correct": correct,
        "mistakes": mistakes,
        "passed": passed,
        "results": results,
    }


# ---------------- Classic exam ----------------
async def start_exam(
    db: AsyncSession,
    user: User,
    settings_row: Settings,
    *,
    topic_id: int | None = None,
    count: int | None = None,
    kind: str = "exam",
) -> tuple[ExamSession, list[Question], int]:
    n = count or settings_row.exam_question_count or 20
    n = max(1, min(int(n), 60))  # clamp: mijoz count=999999 bilan butun bazani dump qila olmasin
    questions = await questions_crud.get_random_questions(db, n, topic_id=topic_id)
    session = ExamSession(user_id=user.id, kind=kind, total=len(questions))
    db.add(session)
    await db.flush()
    duration_sec = (settings_row.exam_duration_min or 25) * 60
    return session, questions, duration_sec


async def get_exam_session(
    db: AsyncSession, session_id: str, user_id: str
) -> ExamSession | None:
    res = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id, ExamSession.user_id == user_id
        )
    )
    return res.scalar_one_or_none()


async def submit_exam(
    db: AsyncSession,
    session: ExamSession,
    user: User,
    settings_row: Settings,
    answers: list[dict],
) -> dict:
    # N+1 oldini olish: barcha savollarni BITTA so'rovda yuklaymiz.
    qids = [(item.get("question_id") or item.get("questionId")) for item in answers]
    questions = await questions_crud.get_questions_by_ids(db, [q for q in qids if q])
    qmap = {q.id: q for q in questions}

    correct = 0
    results = []
    for item in answers:
        qid = item.get("question_id") or item.get("questionId")
        sel = item.get("option_id") or item.get("optionId")
        question = qmap.get(qid)
        cid = correct_option_id(question) if question else None
        is_corr = bool(sel and sel == cid)
        if is_corr:
            correct += 1
        elif qid:
            await interactions_crud.add_mistake(db, user.id, qid)
        db.add(
            ExamAnswer(
                session_id=session.id,
                question_id=qid,
                selected_option_id=sel,
                is_correct=is_corr,
            )
        )
        results.append(
            {
                "questionId": qid,
                "selectedOptionId": sel,
                "correctOptionId": cid,
                "isCorrect": is_corr,
            }
        )

    total = len(answers)
    mistakes = total - correct
    session.total = total
    session.correct = correct
    session.status = ExamStatus.finished
    session.finished_at = _now()
    await db.flush()
    return {
        "sessionId": session.id,
        "total": total,
        "correct": correct,
        "mistakes": mistakes,
        "passed": mistakes <= (settings_row.exam_max_mistakes or 3),
        "results": results,
    }
