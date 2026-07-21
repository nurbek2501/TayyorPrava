"""Bir martalik PostgreSQL bootstrap — bo'sh Postgres'ga image ichidagi app.db'dan
butun kontentni (admin, savollar, mavzular, promokodlar, sozlamalar...) ko'chiradi.

Ishlash sharti:
  * DATABASE_URL — PostgreSQL (sqlite bo'lsa umuman ishlamaydi).
  * Nishon (Postgres) BO'SH bo'lsa (users jadvali 0 qator) — aks holda hech narsa qilmaydi.
Shu tufayli har deploy'da xavfsiz (idempotent): ma'lumot bir marta ko'chiriladi,
keyingi restart'larda o'tkazib yuboriladi. Ish paytida yozilgan yangi ma'lumot yo'qolmaydi.

Turlarni to'g'ri ko'chirish uchun SQLAlchemy Core (`select(table)`) ishlatiladi:
ustun tiplari (DateTime->datetime, Boolean->bool, Enum->str) o'qishda va yozishda
avtomatik konvertatsiya qilinadi — xom qiymat ko'chirishdagi tip xatolari bo'lmaydi.
"""
from __future__ import annotations

import os

from sqlalchemy import func, insert, select, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.core.logging import logger
from app.db.base import Base

# Runtime'da app.db image ichida /app/app.db (WORKDIR /app, COPY . .) — ya'ni "./app.db".
_SQLITE_PATH = os.getenv("BOOTSTRAP_SQLITE_PATH", "app.db")
_SQLITE_URL = f"sqlite+aiosqlite:///{_SQLITE_PATH}"


async def bootstrap_from_sqlite() -> None:
    """Bo'sh Postgres'ni image ichidagi app.db bilan bir marta to'ldiradi."""
    # Faqat Postgres nishon uchun — sqlite ustida ishlaganda ma'no yo'q.
    if settings.DATABASE_URL.startswith("sqlite"):
        return
    if not os.path.exists(_SQLITE_PATH):
        logger.warning("bootstrap: manba app.db topilmadi (%s) — o'tkazib yuborildi", _SQLITE_PATH)
        return

    from app.db.session import engine as target_engine  # nishon (Postgres) engine

    # Nishon bo'sh emasligini tekshiramiz — 'users' jadvalida qator bo'lsa hech narsa qilmaymiz.
    users_table = Base.metadata.tables.get("users")
    if users_table is None:
        logger.warning("bootstrap: 'users' jadvali metadata'da yo'q — o'tkazib yuborildi")
        return

    async with target_engine.connect() as conn:
        existing = await conn.scalar(select(func.count()).select_from(users_table))
    if existing and existing > 0:
        logger.info("bootstrap: Postgres allaqachon to'ldirilgan (%s user) — o'tkazib yuborildi", existing)
        return

    logger.info("bootstrap: bo'sh Postgres aniqlandi — app.db'dan ko'chirish boshlandi")
    source_engine = create_async_engine(_SQLITE_URL, connect_args={"check_same_thread": False})

    copied: dict[str, int] = {}
    try:
        # FK'ga xavfsiz tartib (ota jadvallar avval) — sorted_tables shuni beradi.
        async with source_engine.connect() as src, target_engine.begin() as dst:
            for table in Base.metadata.sorted_tables:
                result = await src.execute(select(table))
                rows = [dict(r._mapping) for r in result]
                if rows:
                    await dst.execute(insert(table), rows)
                    copied[table.name] = len(rows)

            # Postgres ketma-ketliklarini (sequence) MAX(id) ga moslash — aks holda
            # keyingi INSERT'da PK to'qnashuvi bo'ladi (biz id'larni oshkor ko'chirdik).
            for table in Base.metadata.sorted_tables:
                for col in table.primary_key.columns:
                    if not str(col.type).upper().startswith(("INTEGER", "BIGINT")):
                        continue
                    # Ustunga bog'langan sequence bormi? (SERIAL/IDENTITY -> bor, aks holda NULL)
                    seq = await dst.scalar(
                        text("SELECT pg_get_serial_sequence(:tbl, :col)"),
                        {"tbl": table.name, "col": col.name},
                    )
                    if not seq:
                        continue
                    await dst.execute(
                        text(
                            "SELECT setval(:seq, "
                            "COALESCE((SELECT MAX(" + col.name + ") FROM " + table.name + "), 1), true)"
                        ),
                        {"seq": seq},
                    )
    finally:
        await source_engine.dispose()

    total = sum(copied.values())
    logger.info("bootstrap: ko'chirish tugadi — %s jadval, jami %s qator: %s",
                len(copied), total, copied)
