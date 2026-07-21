"""Admin site-settings routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import settings as settings_crud
from app.db.session import get_db
from app.deps import get_current_admin
from app.models.user import User
from app.schemas.settings import SettingsRead, SettingsUpdate

admin_router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


@admin_router.get("", response_model=SettingsRead)
async def get_settings(
    db: AsyncSession = Depends(get_db), _admin: User = Depends(get_current_admin)
):
    row = await settings_crud.get_settings(db)
    await db.commit()
    return row


@admin_router.patch("", response_model=SettingsRead)
async def update_settings(
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    row = await settings_crud.update_settings(
        db, **payload.model_dump(exclude_unset=True)
    )
    await db.commit()
    return row
