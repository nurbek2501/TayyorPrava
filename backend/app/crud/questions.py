"""Question repository (multilingual, options, search, random selection)."""
from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Lang
from app.models.question import (
    Option,
    OptionTranslation,
    Question,
    QuestionTranslation,
)

_LANGS = ("kaa", "uz", "ru")

# ---- Takror tekshiruvi: lotin/kirill farqsiz normalizatsiya ----
# Kirill -> lotin (kichik harf, apostrofsiz) — "Svetofor" va "Светофор" bir xil bo'lsin.
_CYR2LAT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "ғ": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "j", "з": "z", "и": "i", "й": "y", "к": "k", "қ": "q", "л": "l", "м": "m",
    "н": "n", "о": "o", "ў": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "x", "ҳ": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh",
    "ъ": "", "ь": "", "э": "e", "ю": "yu", "я": "ya", "ы": "i",
}


def dup_key(s: str) -> str:
    """Takror kaliti: kirilni lotinga o'girib, faqat harf/raqamlarni qoldiradi."""
    s = (s or "").lower()
    s = "".join(_CYR2LAT.get(c, c) for c in s)
    return re.sub(r"[\W_]+", "", s, flags=re.UNICODE)


async def get_question(db: AsyncSession, question_id: str) -> Optional[Question]:
    res = await db.execute(select(Question).where(Question.id == question_id))
    return res.scalar_one_or_none()


async def count_questions(db: AsyncSession) -> int:
    return (await db.execute(select(func.count()).select_from(Question))).scalar_one()


async def find_duplicate_question(
    db: AsyncSession, text: str, exclude_id: Optional[str] = None
) -> Optional[tuple[str, str]]:
    """Lotin/kirill farqsiz takrorni topadi. (question_id, matn) yoki None qaytaradi."""
    key = dup_key(text)
    if not key:
        return None
    res = await db.execute(
        select(QuestionTranslation.question_id, QuestionTranslation.text)
        .where(QuestionTranslation.lang == Lang("uz"))
    )
    for qid, qtext in res.all():
        if exclude_id and qid == exclude_id:
            continue
        if dup_key(qtext) == key:
            return qid, qtext
    return None


async def check_question_exists(db: AsyncSession, text: str) -> bool:
    return (await find_duplicate_question(db, text)) is not None


async def create_question(
    db: AsyncSession,
    *,
    topic_id: int,
    text: dict,
    explanation: Optional[dict],
    image_url: Optional[str],
    options: list[dict],
) -> Question:
    question = Question(topic_id=topic_id, image_url=image_url)
    db.add(question)
    await db.flush()

    for lang in _LANGS:
        db.add(
            QuestionTranslation(
                question_id=question.id,
                lang=Lang(lang),
                text=(text or {}).get(lang, "") or "",
                explanation=(explanation or {}).get(lang) if explanation else None,
            )
        )

    for idx, opt in enumerate(options):
        is_correct = bool(opt.get("is_correct", opt.get("isCorrect", False)))
        option = Option(question_id=question.id, is_correct=is_correct, order_index=idx)
        db.add(option)
        await db.flush()
        otext = opt.get("text") or {}
        for lang in _LANGS:
            db.add(
                OptionTranslation(
                    option_id=option.id,
                    lang=Lang(lang),
                    text=(otext.get(lang) or ""),
                )
            )

    await db.flush()
    return question


async def update_question(
    db: AsyncSession,
    question: Question,
    *,
    topic_id: Optional[int] = None,
    text: Optional[dict] = None,
    explanation: Optional[dict] = None,
    image_url: Optional[str] = None,
    options: Optional[list[dict]] = None,
) -> Question:
    if topic_id is not None:
        question.topic_id = topic_id
    if image_url is not None:
        question.image_url = image_url

    if text is not None or explanation is not None:
        existing = {t.lang.value if hasattr(t.lang, "value") else t.lang: t
                    for t in question.translations}
        for lang in _LANGS:
            tr = existing.get(lang)
            if tr is None:
                tr = QuestionTranslation(question_id=question.id, lang=Lang(lang), text="")
                db.add(tr)
            if text is not None:
                tr.text = text.get(lang, tr.text) or ""
            if explanation is not None:
                tr.explanation = explanation.get(lang)

    if options is not None:
        for o in list(question.options):
            await db.delete(o)
        await db.flush()
        for idx, opt in enumerate(options):
            is_correct = bool(opt.get("is_correct", opt.get("isCorrect", False)))
            option = Option(question_id=question.id, is_correct=is_correct, order_index=idx)
            db.add(option)
            await db.flush()
            otext = opt.get("text") or {}
            for lang in _LANGS:
                db.add(
                    OptionTranslation(
                        option_id=option.id, lang=Lang(lang), text=(otext.get(lang) or "")
                    )
                )
    await db.flush()
    return question


async def delete_question(db: AsyncSession, question: Question) -> None:
    await db.delete(question)


async def list_questions(
    db: AsyncSession,
    *,
    topic_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Question], int]:
    # Clamp: page>=1, page_size 1..100 (page=0 -> manfiy OFFSET -> Postgresda 500).
    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 100))
    stmt = select(Question)
    count_stmt = select(func.count()).select_from(Question)

    if topic_id is not None:
        stmt = stmt.where(Question.topic_id == topic_id)
        count_stmt = count_stmt.where(Question.topic_id == topic_id)

    if search:
        like = f"%{search.strip()}%"
        sub = (
            select(QuestionTranslation.id)
            .where(
                QuestionTranslation.question_id == Question.id,
                QuestionTranslation.text.ilike(like),
            )
            .exists()
        )
        stmt = stmt.where(sub)
        count_stmt = count_stmt.where(sub)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = (
        stmt.order_by(Question.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(stmt)).scalars().all()
    return list(items), total


async def get_questions_by_topic(
    db: AsyncSession,
    topic_id: int,
    *,
    limit: Optional[int] = None,
    offset: int = 0,
) -> list[Question]:
    # Barqaror tartib (ticket_number, order_index) -> limit/offset sahifalash izchil.
    stmt = (
        select(Question)
        .where(Question.topic_id == topic_id)
        .order_by(Question.ticket_number, Question.order_index)
    )
    if limit is not None:
        stmt = stmt.offset(offset).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


async def list_tickets(db: AsyncSession) -> list[tuple[int, int]]:
    res = await db.execute(
        select(Question.ticket_number, func.count(Question.id))
        .where(Question.ticket_number > 0)
        .group_by(Question.ticket_number)
        .order_by(Question.ticket_number)
    )
    return [(num, cnt) for num, cnt in res.all()]


async def get_questions_by_ticket(
    db: AsyncSession,
    ticket_number: int,
    *,
    limit: Optional[int] = None,
    offset: int = 0,
) -> list[Question]:
    # Bilet a'zoligi doimiy (ticket_number), tartib har chaqiruvda tasodifiy.
    # Bilet 20 savoldan iborat -> limit=20 bilan bitta partiyada keladi.
    stmt = (
        select(Question)
        .where(Question.ticket_number == ticket_number)
        .order_by(func.random())
    )
    if limit is not None:
        stmt = stmt.offset(offset).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


async def get_random_questions(
    db: AsyncSession,
    count: int,
    *,
    topic_id: Optional[int] = None,
    max_topic_id: Optional[int] = None,
) -> list[Question]:
    stmt = select(Question)
    if topic_id is not None:
        stmt = stmt.where(Question.topic_id == topic_id)
    elif max_topic_id is not None:
        # Bepul foydalanuvchi uchun: faqat namuna (demo) mavzulardan tasodifiy.
        stmt = stmt.where(Question.topic_id <= max_topic_id)
    stmt = stmt.order_by(func.random()).limit(count)
    return list((await db.execute(stmt)).scalars().all())


async def get_questions_by_ids(db: AsyncSession, ids: list[str]) -> list[Question]:
    if not ids:
        return []
    res = await db.execute(select(Question).where(Question.id.in_(ids)))
    by_id = {q.id: q for q in res.scalars().all()}
    return [by_id[i] for i in ids if i in by_id]


async def topic_distribution(db: AsyncSession) -> list[tuple[int, int]]:
    res = await db.execute(
        select(Question.topic_id, func.count(Question.id)).group_by(Question.topic_id)
    )
    return [(tid, cnt) for tid, cnt in res.all()]
