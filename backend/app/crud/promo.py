"""Promokodlar repozitoriysi: admin chegirma kodlari + shaxsiy (bonusga olingan) kodlar."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.promo import PersonalPromoCode, PromoCode, PromoCodeRedemption
from app.models.user import User


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


# ---------------- Shaxsiy promokodlar (bonusga sotib olingan) ----------------
# Chalkash belgilarsiz alifbo (O/0, I/1 yo'q) — foydalanuvchi kodni qo'lda ko'chiradi.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_PREFIX = "MY"


def _gen_personal_code() -> str:
    rnd = secrets.SystemRandom()
    return _CODE_PREFIX + "".join(rnd.choice(_CODE_ALPHABET) for _ in range(6))


async def get_personal_by_code(
    db: AsyncSession, code: str
) -> Optional[PersonalPromoCode]:
    """Kod bo'yicha shaxsiy promokodni topadi (ishlatilgan bo'lsa ham qaytaradi —
    chaqiruvchi «allaqachon foydalangansiz» xabarini bera olishi uchun)."""
    res = await db.execute(
        select(PersonalPromoCode).where(
            PersonalPromoCode.code == (code or "").strip().upper()
        )
    )
    return res.scalar_one_or_none()


async def _code_is_free(db: AsyncSession, code: str) -> bool:
    """Kod ikkala jadvalda ham band emasligini tekshiradi (to'qnashuv bo'lmasin)."""
    if await get_by_code_any(db, code):
        return False
    return await get_personal_by_code(db, code) is None


async def buy_personal_code(
    db: AsyncSession, *, user: User, price: int
) -> Optional[PersonalPromoCode]:
    """Bonusdan `price` yechib, foydalanuvchiga shaxsiy promokod yaratadi.

    Balans yetmasa yoki bir vaqtda ikkinchi so'rov uni bo'shatib ulgurgan bo'lsa
    None qaytaradi — pul IKKI MARTA yechilmasligi kafolatlanadi, chunki yechish
    shartli UPDATE bilan (WHERE bonus_balance >= price) bajariladi.
    Commit qilish chaqiruvchi zimmasida.
    """
    res = await db.execute(
        update(User)
        .where(User.id == user.id, User.bonus_balance >= price)
        .values(bonus_balance=User.bonus_balance - price)
    )
    if res.rowcount != 1:
        return None

    for _ in range(10):  # kod to'qnashuvi ehtimoli juda past, baribir qayta urinamiz
        code = _gen_personal_code()
        if not await _code_is_free(db, code):
            continue
        row = PersonalPromoCode(code=code, user_id=user.id, price_paid=price)
        db.add(row)
        try:
            await db.flush()
            return row
        except IntegrityError:
            await db.rollback()
            raise
    return None


async def consume_personal_code(db: AsyncSession, row: PersonalPromoCode) -> bool:
    """Kodni ATOMIK ravishda «ishlatilgan» deb belgilaydi.

    True — shu chaqiruv kodni ishlatdi; False — kod allaqachon ishlatilgan
    (bir vaqtda kelgan ikkinchi so'rov ham shu yerda to'xtaydi).
    """
    res = await db.execute(
        update(PersonalPromoCode)
        .where(PersonalPromoCode.id == row.id, PersonalPromoCode.used.is_(False))
        .values(used=True, used_at=datetime.now(timezone.utc))
    )
    return res.rowcount == 1


async def list_personal_codes(
    db: AsyncSession, user_id: str
) -> list[PersonalPromoCode]:
    """Foydalanuvchining sotib olgan kodlari (yangisi birinchi)."""
    res = await db.execute(
        select(PersonalPromoCode)
        .where(PersonalPromoCode.user_id == user_id)
        .order_by(PersonalPromoCode.created_at.desc())
    )
    return list(res.scalars().all())
