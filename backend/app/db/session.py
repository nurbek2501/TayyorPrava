"""Async SQLAlchemy engine + session factory."""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

_IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")

# `check_same_thread` is only relevant for sqlite.
connect_args = {"check_same_thread": False} if _IS_SQLITE else {}

# Engine sozlamalari. Yirik foydalanuvchi oqimi uchun:
#  - SQLite: WAL + busy_timeout (pastda pragma'larda) konkurentlikni oshiradi, ammo
#    100k+ bir vaqtdagi YOZISH uchun PostgreSQL tavsiya etiladi (URL ni o'zgartirish kifoya).
#  - PostgreSQL: connection pool (pool_size/max_overflow) + pre_ping bilan tayyor.
engine_kwargs: dict = {"echo": False, "future": True, "pool_pre_ping": True}
if not _IS_SQLITE:
    engine_kwargs.update(
        {"pool_size": 20, "max_overflow": 40, "pool_recycle": 1800, "pool_timeout": 30}
    )

engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

if _IS_SQLITE:

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        """SQLite ni konkurent yukka tayyorlash (WAL) + FK majburlash."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        # WAL: bir vaqtda ko'p O'QISH + 1 yozish (default rollback journal butun bazani qulflaydi).
        cursor.execute("PRAGMA journal_mode=WAL")
        # Qulf bo'lsa darhol xato bermay 5s kutadi ("database is locked" ni keskin kamaytiradi).
        cursor.execute("PRAGMA busy_timeout=5000")
        # WAL bilan xavfsiz va tezroq.
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
