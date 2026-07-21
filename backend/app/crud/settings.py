"""Site-settings repository (single row, id=1)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import Settings


async def get_settings(db: AsyncSession) -> Settings:
    res = await db.execute(select(Settings).where(Settings.id == 1))
    row = res.scalar_one_or_none()
    if row is None:
        row = Settings(id=1)
        db.add(row)
        await db.flush()
    return row


async def update_settings(db: AsyncSession, **data) -> Settings:
    row = await get_settings(db)
    for key, value in data.items():
        if value is not None:
            setattr(row, key, value)
    await db.flush()
    return row
