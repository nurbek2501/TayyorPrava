"""Butun savollar bazasini yangi JSON bilan almashtirish.

Format (savollar_2026-06-18.json):
{
  "savollar": [
    {
      "id": "...", "raqam": 1, "rasm": "images/u57uz.webp" | null,
      "uz_lotin":  {"savol": "...", "variantlar": [{"matn": "...", "togri": bool}, ...]},
      "uz_kirill": {"savol": "...", "variantlar": [{"matn": "...", "togri": bool}, ...]}
    }, ...
  ]
}

Amal: barcha mavzu va savollar o'chiriladi, bitta "Barcha savollar" mavzusi
yaratiladi va hamma savol shunga import qilinadi. uz_lotin -> uz (lotin),
uz_kirill -> kaa (kirill), ru -> bo'sh. Rasm yo'li `/static/<rasm>` ko'rinishida
saqlanadi (fayllar backend/uploads/<rasm> ichida turishi kerak).
"""
from __future__ import annotations

import asyncio
import json
import sys
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

TOPIC_NAME = {
    "uz": "Barcha savollar",
    "kaa": "Барча саволлар",
    "ru": "Все вопросы",
}


async def replace(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("savollar") or []
    if not items:
        sys.exit("JSON'da 'savollar' bo'sh yoki topilmadi")

    async with AsyncSessionLocal() as db:
        # 1) Eski bazani tozalash (FK cascade barcha bog'liq qatorlarni o'chiradi).
        await db.execute(delete(Question).execution_options(synchronize_session=False))
        await db.execute(delete(Topic).execution_options(synchronize_session=False))
        await db.flush()

        # 2) Bitta umumiy mavzu.
        topic = Topic(
            id=1,
            name_uz=TOPIC_NAME["uz"],
            name_kaa=TOPIC_NAME["kaa"],
            name_ru=TOPIC_NAME["ru"],
            order_index=1,
        )
        db.add(topic)
        await db.flush()

        # 3) Savollarni import qilish.
        added = with_image = 0
        for q in items:
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
                topic_id=1,
                image_url=image_url,
                order_index=int(q.get("raqam") or 0),
                ticket_number=0,
            )
            db.add(question)
            await db.flush()

            db.add(QuestionTranslation(question_id=question.id, lang=Lang("uz"), text=qtext))
            db.add(
                QuestionTranslation(
                    question_id=question.id,
                    lang=Lang("kaa"),
                    text=(kir.get("savol") or "").strip(),
                )
            )
            db.add(QuestionTranslation(question_id=question.id, lang=Lang("ru"), text=""))

            lv = lot.get("variantlar") or []
            kv = kir.get("variantlar") or []
            for i, ov in enumerate(lv):
                opt = Option(
                    question_id=question.id,
                    is_correct=bool(ov.get("togri")),
                    order_index=i,
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

        total = (
            await db.execute(select(func.count()).select_from(Question))
        ).scalar_one()
        topics = (await db.execute(select(func.count()).select_from(Topic))).scalar_one()
        print(f"Import: {added} ta savol ({with_image} rasmli)")
        print(f"Bazada: {total} savol, {topics} mavzu")


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Foydalanish: python replace_questions.py <savollar.json>")
    p = Path(sys.argv[1])
    if not p.exists():
        sys.exit(f"Fayl topilmadi: {p}")
    asyncio.run(replace(p))


if __name__ == "__main__":
    main()
