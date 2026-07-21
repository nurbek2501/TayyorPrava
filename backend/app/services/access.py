"""Tarifga asoslangan kontentga kirish nazorati (bepul namuna vs aktiv tarif).

Bepul (obunasiz) foydalanuvchilar faqat namunani ko'radi (topic/bilet 1..DEMO_*).
Admin yoki aktiv obunasi (tarif) bor foydalanuvchilar — butun bazaga kira oladi.
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import users as users_crud
from app.models.enums import Role
from app.models.user import User

# Bu 403'da maxsus belgi (X-Content-Gate) bor — frontend uni "akkaunt bloki" deb
# olmaydi va xavfsizlik tizimi uni suiiste'mol deb hisoblamaydi.
_PAYWALL_DETAIL = (
    "Bu kontent faqat aktiv tarifi bor foydalanuvchilar uchun. Tarif sotib oling."
)


def paywall() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=_PAYWALL_DETAIL,
        headers={"X-Content-Gate": "tariff"},
    )


async def has_full_access(db: AsyncSession, user: User) -> bool:
    """Admin yoki aktiv obunasi bor bo'lsa -> butun savol bazasi."""
    if user.role == Role.admin:
        return True
    sub = await users_crud.get_active_subscription(db, user.id)
    return sub is not None
