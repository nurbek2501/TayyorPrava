"""Shared FastAPI dependencies (auth, role checks)."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.crud import users as users_crud
from app.db.session import get_db
from app.models.enums import Role
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_PREFIX}/auth/login", auto_error=False
)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Avtorizatsiyadan o'tilmagan",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise cred_exc
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise cred_exc
    user_id = payload.get("sub")
    if not user_id:
        raise cred_exc
    user = await users_crud.get_user_by_id(db, user_id)
    if user is None:
        raise cred_exc
    if user.is_blocked:
        # Eskalatsiya muddati tugagan bo'lsa — avtomatik ochiladi
        await users_crud.auto_unblock_if_expired(db, user)
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=user.block_reason
            or "Akkaunt bloklangan. Administrator bilan bog'laning.",
        )
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin huquqi talab qilinadi"
        )
    return user


async def get_current_teacher(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.teacher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Ustoz huquqi talab qilinadi"
        )
    return user
