"""Admin user-management routes."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import users as users_crud
from app.db.session import get_db
from app.deps import get_current_admin
from app.models.user import User
from app.schemas.user import AdminUserUpdate, UserListResponse, UserRead
from app.services.serializers import serialize_user

admin_router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@admin_router.get("", response_model=UserListResponse)
async def list_users(
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    items, total = await users_crud.list_users(
        db, search=search, page=page, page_size=page_size
    )
    result = []
    for u in items:
        sub = await users_crud.get_active_subscription(db, u.id)
        result.append(
            serialize_user(
                u,
                subscription_active=sub is not None,
                subscription_expires_at=sub.expires_at if sub else None,
            )
        )
    return {"items": result, "total": total, "page": page, "pageSize": page_size}


@admin_router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    user = await users_crud.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    if payload.is_blocked is not None:
        user.is_blocked = payload.is_blocked
        if payload.is_blocked:
            # Admin qo'lda bloklasa — avto-ochilmaydi (faqat admin ochadi).
            user.block_until = None
            if not user.block_reason:
                user.block_reason = "Administrator tomonidan bloklandi"
                user.blocked_at = datetime.now(timezone.utc)
        else:
            # Admin ochdi — toza varaq (eskalatsiya hisobi ham nolga tushadi).
            user.block_reason = None
            user.blocked_at = None
            user.block_until = None
            user.block_count = 0
    await db.commit()
    sub = await users_crud.get_active_subscription(db, user.id)
    return serialize_user(
        user,
        subscription_active=sub is not None,
        subscription_expires_at=sub.expires_at if sub else None,
    )


@admin_router.post("/{user_id}/unbind-telegram", response_model=UserRead)
async def unbind_telegram(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Userning Telegram bog'lanishini bekor qiladi — boshqa telegramdan qayta bog'lash mumkin bo'ladi."""
    user = await users_crud.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    user.telegram_id = None
    await db.commit()
    sub = await users_crud.get_active_subscription(db, user.id)
    return serialize_user(
        user,
        subscription_active=sub is not None,
        subscription_expires_at=sub.expires_at if sub else None,
    )
