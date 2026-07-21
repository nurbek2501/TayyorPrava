"""Savollarni eski bazadagi 42 mavzuga turiga qarab taqsimlab almashtirish.

Mavzular O'ZGARMAYDI (eski 42 ta saqlanadi). Faqat savollar yangilanadi:
har bir yangi savol matni bo'yicha eski bazadagi savolga moslab, o'sha mavzuga
biriktiriladi (97% aniq mos). Mos kelmaganlar fuzzy + kalit-so'z bilan
aniqlanadi. Rasm yo'li `/static/<rasm>` (fayllar backend/uploads/ ichida).
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from collections import Counter
from pathlib import Path

from sqlalchemy import delete, func, select

from app.db.session import AsyncSessionLocal
from app.models.enums import Lang
from app.models.question import (
    Option,
    OptionTranslation,
    Question,
    QuestionTranslation,
)
from app.models.topic import Topic


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _fuzz(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-zа-яё0-9 ]", " ", s).replace("x", "h")
    return re.sub(r"\s+", " ", s).strip()


# Mos kelmaganlar uchun kalit-so'z fallback (kamdan-kam ishlatiladi).
_KW: list[tuple[int, list[str]]] = [
    (19, ["chorrax", "chorraha"]),
    (1, ["atama", "ta'rif", "tarif", "deganda nima"]),
    (20, ["piyoda"]),
    (34, ["havfsizlik", "xavfsizlik"]),
    (10, ["razmetka"]),
    (3, ["belgi"]),
]


def _keyword_topic(s: str) -> int:
    s = s.lower()
    for tid, words in _KW:
        if any(w in s for w in words):
            return tid
    return 1  # default: Umumiy qoidalar


async def run(json_path: Path) -> None:
    new = json.loads(json_path.read_text(encoding="utf-8")).get("savollar") or []
    if not new:
        sys.exit("JSON'da 'savollar' yo'q")

    async with AsyncSessionLocal() as db:
        # 1) Eski savol->mavzu xaritasini O'CHIRISHDAN OLDIN o'qib olamiz.
        rows = (
            await db.execute(
                select(QuestionTranslation.text, Question.topic_id)
                .join(Question, Question.id == QuestionTranslation.question_id)
                .where(QuestionTranslation.lang == Lang("uz"))
            )
        ).all()
        exact = {_norm(t): tid for t, tid in rows}
        fuzzy: dict[str, int] = {}
        for t, tid in rows:
            fuzzy.setdefault(_fuzz(t), tid)

        valid_topics = {
            tid for (tid,) in (await db.execute(select(Topic.id))).all()
        }

        # 2) Har bir yangi savolga mavzu biriktiramiz.
        method = Counter()
        plan: list[int] = []
        for q in new:
            t = q["uz_lotin"]["savol"]
            n = _norm(t)
            if n in exact:
                tid = exact[n]; method["exact"] += 1
            elif _fuzz(t) in fuzzy:
                tid = fuzzy[_fuzz(t)]; method["fuzzy"] += 1
            else:
                tid = _keyword_topic(t); method["keyword"] += 1
            if tid not in valid_topics:
                tid = 1
            plan.append(tid)

        # 3) Eski savollarni o'chiramiz (mavzular qoladi). FK cascade bog'liqlarni ham.
        await db.execute(delete(Question).execution_options(synchronize_session=False))
        await db.flush()

        # 4) Yangi savollarni mos mavzularga import qilamiz.
        added = with_image = 0
        for q, topic_id in zip(new, plan):
            lot = q.get("uz_lotin") or {}
            kir = q.get("uz_kirill") or {}
            qtext = (lot.get("savol") or "").strip()
            if not qtext:
                continue
            rasm = q.get("rasm")
            image_url = f"/static/{rasm}" if rasm else None
            if image_url:
                with_image += 1

            question = Question(
                topic_id=topic_id,
                image_url=image_url,
                order_index=int(q.get("raqam") or 0),
                ticket_number=0,
            )
            db.add(question)
            await db.flush()

            db.add(QuestionTranslation(question_id=question.id, lang=Lang("uz"), text=qtext))
            db.add(
                QuestionTranslation(
                    question_id=question.id, lang=Lang("kaa"),
                    text=(kir.get("savol") or "").strip(),
                )
            )
            db.add(QuestionTranslation(question_id=question.id, lang=Lang("ru"), text=""))

            lv = lot.get("variantlar") or []
            kv = kir.get("variantlar") or []
            for i, ov in enumerate(lv):
                opt = Option(
                    question_id=question.id, is_correct=bool(ov.get("togri")), order_index=i
                )
                db.add(opt)
                await db.flush()
                db.add(
                    OptionTranslation(
                        option_id=opt.id, lang=Lang("uz"), text=(ov.get("matn") or "").strip()
                    )
                )
                kmatn = kv[i].get("matn") if i < len(kv) else ""
                db.add(
                    OptionTranslation(
                        option_id=opt.id, lang=Lang("kaa"), text=(kmatn or "").strip()
                    )
                )
                db.add(OptionTranslation(option_id=opt.id, lang=Lang("ru"), text=""))
            added += 1

        await db.commit()

        total = (await db.execute(select(func.count()).select_from(Question))).scalar_one()
        topics = (await db.execute(select(func.count()).select_from(Topic))).scalar_one()
        print(f"Moslash: {dict(method)}")
        print(f"Import: {added} savol ({with_image} rasmli)")
        print(f"Bazada: {total} savol, {topics} mavzu (mavzular o'zgarmadi)")


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Foydalanish: python assign_and_replace.py <questions.json>")
    p = Path(sys.argv[1])
    if not p.exists():
        sys.exit(f"Fayl topilmadi: {p}")
    asyncio.run(run(p))


if __name__ == "__main__":
    main()
