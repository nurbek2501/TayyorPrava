"""Chegirma promokodlari repozitoriysi (real imtihon narxiga admin belgilagan foiz)."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.promo import PromoCode, PromoCodeRedemption


async def list_promo_codes(db: AsyncSession) -> list[PromoCode]:
    res = await db.execute(select(PromoCode).order_by(PromoCode.created_at.desc()))
    return list(res.scalars().all())


async def get_promo_code(db: AsyncSession, promo_id: str) -> Optional[PromoCode]:
    return await db.get(PromoCode, promo_id)


async def get_by_code_any(db: AsyncSession, code: str) -> Optional[PromoCode]:
    """Kod bo'yicha topadi (faol/nofaol farqsiz) — yaratishda unikalikni tekshirish uchun."""
    res = await db.execute(
        select(PromoCode).where(PromoCode.code == code.strip().upper())
    )
    return res.scalar_one_or_none()


async def get_active_by_code(db: AsyncSession, code: str) -> Optional[PromoCode]:
    """Kod bo'yicha FAOL promokodni topadi — real imtihon sotib olishda ishlatiladi."""
    res = await db.execute(
        select(PromoCode).where(
            PromoCode.code == code.strip().upper(), PromoCode.is_active.is_(True)
        )
    )
    return res.scalar_one_or_none()


async def create_promo_code(
    db: AsyncSession, *, code: str, discount_percent: int
) -> PromoCode:
    promo = PromoCode(code=code.strip().upper(), discount_percent=discount_percent)
    db.add(promo)
    await db.flush()
    return promo


async def update_promo_code(
    db: AsyncSession,
    promo: PromoCode,
    *,
    discount_percent: Optional[int] = None,
    is_active: Optional[bool] = None,
) -> PromoCode:
    if discount_percent is not None:
        promo.discount_percent = discount_percent
    if is_active is not None:
        promo.is_active = is_active
    await db.flush()
    return promo


async def delete_promo_code(db: AsyncSession, promo: PromoCode) -> None:
    await db.delete(promo)


async def increment_usage(db: AsyncSession, promo: PromoCode) -> None:
    promo.used_count = (promo.used_count or 0) + 1
    await db.flush()


async def has_user_redeemed(db: AsyncSession, promo_id: str, user_id: str) -> bool:
    """Bu user shu promokoddan avval foydalanganmi — bir marta ishlatish cheklovi."""
    res = await db.execute(
        select(PromoCodeRedemption).where(
            PromoCodeRedemption.promo_code_id == promo_id,
            PromoCodeRedemption.user_id == user_id,
        )
    )
    return res.scalar_one_or_none() is not None


async def record_redemption(db: AsyncSession, promo_id: str, user_id: str) -> None:
    db.add(PromoCodeRedemption(promo_code_id=promo_id, user_id=user_id))
    await db.flush()
