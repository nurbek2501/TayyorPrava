# -*- coding: utf-8 -*-
"""One-time: replace topics with the 44 new ones and import the 1224-question
3-language base from pdd_1224.json. Run from backend/:  python load_new_base.py
"""
import asyncio
import app.models  # noqa: F401
from sqlalchemy import delete, select, func
from app.db.session import AsyncSessionLocal
from app.models.topic import Topic
from app.models.question import Question
from app.data_import import import_questions, topics as pdd_topics


async def main() -> None:
    async with AsyncSessionLocal() as db:
        # savollar avval tozalangan bo'lishi kerak (bo'sh baza)
        qn = (await db.execute(select(func.count()).select_from(Question))).scalar_one()
        if qn:
            print(f"DIQQAT: bazada {qn} savol bor. Avval tozalang.")
            return
        # eski mavzularni almashtirish
        await db.execute(delete(Topic))
        for t in pdd_topics():
            db.add(Topic(id=t["id"], name_uz=t["name_uz"], name_kaa=t["name_kaa"],
                         name_ru=t["name_ru"], order_index=t["id"]))
        await db.flush()
        print(f"  {len(pdd_topics())} mavzu qo'yildi")
        n = await import_questions(db)
        await db.commit()
        print(f"  {n} savol import qilindi")


if __name__ == "__main__":
    asyncio.run(main())
