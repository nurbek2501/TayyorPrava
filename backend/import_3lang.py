"""3 tilli (uz/kaa/ru) questions_3lang.json ni bazaga import qilish.

Foydalanish:
    python import_3lang.py seed_3lang/questions_3lang.json [--db <fayl>] [--replace]

--db       : maqsad sqlite fayli (default: .env dagi app.db). Test uchun nusxa bering.
--replace  : importdan oldin BARCHA savollarni o'chirish (qayta ishga tushirsa bo'ladi).

Matn {uz,kaa,ru} dict ko'rinishida — create_question to'g'ridan-to'g'ri saqlaydi.
Rasm: image_url JSON'da /static/... ko'rinishida tayyor.
"""
from __future__ import annotations
import argparse, asyncio, json, os, sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("json_path")
    ap.add_argument("--db", default=None, help="sqlite fayl (berilmasa .env app.db)")
    ap.add_argument("--replace", action="store_true")
    args = ap.parse_args()

    if args.db:
        os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{Path(args.db).as_posix()}"

    # app modullari DATABASE_URL ni o'qiganidan keyin import qilinadi
    from sqlalchemy import delete, func, select
    from app.db.session import AsyncSessionLocal, engine
    from app.db.base import Base
    from app import models  # noqa: F401  (modellarni ro'yxatga olish)
    from app.crud import questions as qcrud
    from app.models.question import Question

    path = Path(args.json_path)
    if not path.exists():
        sys.exit(f"Fayl topilmadi: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("questions", data if isinstance(data, list) else [])

    async def run() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with AsyncSessionLocal() as db:
            if args.replace:
                await db.execute(delete(Question).execution_options(synchronize_session=False))
                await db.flush()
            added = with_img = with_ru = 0
            for q in items:
                opts = [
                    {"text": o["text"], "is_correct": bool(o.get("is_correct"))}
                    for o in q.get("options", []) if (o.get("text") or {}).get("uz")
                ]
                if not opts or not any(o["is_correct"] for o in opts):
                    continue
                created = await qcrud.create_question(
                    db,
                    topic_id=int(q.get("topic_id") or 1),
                    text=q["text"],
                    explanation=q.get("explanation"),
                    image_url=q.get("image_url"),
                    options=opts,
                )
                created.order_index = int(q.get("order_index") or 0)
                created.ticket_number = int(q.get("ticket_number") or 0)
                added += 1
                if q.get("image_url"):
                    with_img += 1
                if (q["text"].get("ru") or "").strip():
                    with_ru += 1
            await db.commit()
            total = (await db.execute(select(func.count()).select_from(Question))).scalar_one()
            # til bo'yicha to'ldirilganlik
            from app.models.question import QuestionTranslation as QT
            async def lang_cnt(l):
                return (await db.execute(
                    select(func.count()).select_from(QT)
                    .where(QT.lang == l).where(func.trim(QT.text) != "")
                )).scalar_one()
            from app.models.enums import Lang
            uz = await lang_cnt(Lang("uz")); kaa = await lang_cnt(Lang("kaa")); ru = await lang_cnt(Lang("ru"))
            print(f"Import: {added} savol ({with_img} rasmli, {with_ru} ruscha savol matni)")
            print(f"Bazada jami savol: {total}")
            print(f"Savol matni to'ldirilgan -> uz:{uz}  kaa:{kaa}  ru:{ru}")
        await engine.dispose()

    asyncio.run(run())


if __name__ == "__main__":
    main()
