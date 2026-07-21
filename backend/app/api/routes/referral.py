"""Admin referral overview."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import settings as settings_crud
from app.db.session import get_db
from app.deps import get_current_admin
from app.models.user import Referral, User

admin_router = APIRouter(prefix="/admin/referral", tags=["admin-referral"])


@admin_router.get("")
async def referral_overview(
    db: AsyncSession = Depends(get_db), _admin: User = Depends(get_current_admin)
):
    total_invited = (
        await db.execute(select(func.count()).select_from(Referral))
    ).scalar_one() or 0
    total_paid = (
        await db.execute(
            select(func.count()).select_from(Referral).where(Referral.has_paid.is_(True))
        )
    ).scalar_one() or 0
    total_bonus = (
        await db.execute(select(func.coalesce(func.sum(Referral.bonus), 0)))
    ).scalar_one() or 0
    settings_row = await settings_crud.get_settings(db)
    return {
        "totalInvited": int(total_invited),
        "totalPaid": int(total_paid),
        "totalBonus": int(total_bonus),
        "bonusPerReferral": settings_row.referral_bonus,
    }
