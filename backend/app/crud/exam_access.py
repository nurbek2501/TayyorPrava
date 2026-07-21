"""Real imtihon pulli kirish (ticket) repozitoriysi."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam_access import RealExamAccess


async def create_access(
    db: AsyncSession, *, user_id: str, amount: int, method: str = ""
) -> RealExamAccess:
    access = RealExamAccess(user_id=user_id, amount=amount, method=method)
    db.add(access)
    await db.flush()
    return access


async def get_unused_access(
    db: AsyncSession, user_id: str
) -> Optional[RealExamAccess]:
    res = await db.execute(
        select(RealExamAccess)
        .where(RealExamAccess.user_id == user_id, RealExamAccess.used.is_(False))
        .order_by(RealExamAccess.created_at.asc())
        .limit(1)
    )
    return res.scalar_one_or_none()


async def has_unused(db: AsyncSession, user_id: str) -> bool:
    return (await get_unused_access(db, user_id)) is not None


async def consume_access(db: AsyncSession, access: RealExamAccess) -> None:
    access.used = True
    access.used_at = datetime.now(timezone.utc)
    await db.flush()
