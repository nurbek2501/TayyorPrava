"""User / subscription / referral repository."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import Role
from app.models.user import Referral, Subscription, User


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    res = await db.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()


async def get_user_by_phone(db: AsyncSession, phone: str) -> Optional[User]:
    res = await db.execute(select(User).where(User.phone == phone))
    return res.scalar_one_or_none()


async def get_user_by_nickname(db: AsyncSession, nickname: str) -> Optional[User]:
    """Nik bo'yicha qidirish — katta-kichik harfga sezgir EMAS (bandlik/tiklash uchun).

    Demo1234 == demo1234. Ro'yxat bandligi va parol tiklashda ishlatiladi.
    """
    res = await db.execute(
        select(User).where(func.lower(User.nickname) == (nickname or "").lower())
    )
    return res.scalar_one_or_none()


async def get_user_by_nickname_exact(
    db: AsyncSession, nickname: str
) -> Optional[User]:
    """Nik bo'yicha ANIQ qidirish — katta-kichik harfga sezgir (Demo1234 != demo1234).

    Kirish (login) uchun: foydalanuvchi nikni ro'yxatdagidek aniq yozishi shart.
    """
    res = await db.execute(
        select(User).where(User.nickname == (nickname or "").strip())
    )
    return res.scalar_one_or_none()


async def get_user_by_telegram_id(
    db: AsyncSession, telegram_id: str
) -> Optional[User]:
    """Telegram akkaunt qaysi userga bog'langanini topadi (bir telegram = bir nik)."""
    if not telegram_id:
        return None
    res = await db.execute(select(User).where(User.telegram_id == telegram_id))
    return res.scalar_one_or_none()


async def get_user_by_ref_code(db: AsyncSession, code: str) -> Optional[User]:
    res = await db.execute(select(User).where(User.ref_code == code))
    return res.scalar_one_or_none()


def _generate_ref_code() -> str:
    """Promokod: 6 belgi — kamida 1 harf + 1 raqam, chalkash belgilarsiz (O/0/I/1 yo'q)."""
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    digits = "23456789"
    pool = letters + digits
    rnd = secrets.SystemRandom()
    chars = [rnd.choice(letters), rnd.choice(digits)] + [rnd.choice(pool) for _ in range(4)]
    rnd.shuffle(chars)
    return "".join(chars)


async def create_user(
    db: AsyncSession,
    *,
    name: str,
    phone: str,
    password: Optional[str] = None,
    password_hash: Optional[str] = None,
    surname: Optional[str] = None,
    nickname: Optional[str] = None,
    email: Optional[str] = None,
    telegram: Optional[str] = None,
    role: Role = Role.user,
    referred_by: Optional[str] = None,
) -> User:
    user = User(
        name=name,
        surname=surname,
        nickname=nickname,
        phone=phone,
        email=email,
        telegram=telegram,
        password_hash=password_hash or hash_password(password or ""),
        role=role,
        ref_code=_generate_ref_code(),
        referred_by=referred_by,
    )
    db.add(user)
    await db.flush()
    return user


async def auto_unblock_if_expired(db: AsyncSession, user: User) -> bool:
    """Blok muddati (block_until) tugagan bo'lsa akkauntni avtomatik ochadi.

    block_count SAQLANADI — keyingi hujumda eskalatsiya davom etadi (5→15→admin).
    Qaytaradi: True = akkaunt endi ochiq, False = hali bloklangan (admin kerak yoki vaqt yetmagan).
    """
    if not user.is_blocked:
        return True
    if user.block_until is None:
        return False  # faqat admin ochadi
    until = user.block_until
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    if until <= datetime.now(timezone.utc):
        user.is_blocked = False
        user.block_reason = None
        user.blocked_at = None
        user.block_until = None
        await db.commit()
        return True
    return False


async def get_active_subscription(
    db: AsyncSession, user_id: str
) -> Optional[Subscription]:
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(Subscription)
        .where(
            Subscription.user_id == user_id,
            Subscription.is_active.is_(True),
        )
        .order_by(Subscription.expires_at.desc())
    )
    for sub in res.scalars().all():
        if sub.expires_at is None:
            return sub
        exp = sub.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > now:
            return sub
    return None


async def grant_subscription(
    db: AsyncSession, *, user_id: str, tariff_id: Optional[str], duration_days: int
) -> Subscription:
    """Aktiv obuna beradi/uzaytiradi (to'lov tasdiqlanganda). Mavjud aktiv obuna bo'lsa,
    yangi muddat uning tugash sanasidan boshlab qo'shiladi (bittasi aktiv qoladi)."""
    now = datetime.now(timezone.utc)
    base = now
    current = await get_active_subscription(db, user_id)
    if current is not None:
        if current.expires_at is not None:
            exp = current.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now:
                base = exp
        current.is_active = False  # bitta aktiv obuna bo'lsin — eskisi o'rniga yangisi
    sub = Subscription(
        user_id=user_id,
        tariff_id=tariff_id,
        expires_at=base + timedelta(days=max(1, int(duration_days))),
        is_active=True,
    )
    db.add(sub)
    await db.flush()
    return sub


async def list_users(
    db: AsyncSession, *, search: Optional[str] = None, page: int = 1, page_size: int = 20
) -> tuple[list[User], int]:
    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 100))
    stmt = select(User).where(User.role == Role.user)
    count_stmt = select(func.count()).select_from(User).where(User.role == Role.user)
    if search:
        like = f"%{search}%"
        cond = or_(User.name.ilike(like), User.phone.ilike(like))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()
    return list(items), total


async def create_referral(
    db: AsyncSession, *, referrer_id: str, referred_user_id: str, bonus: int = 0
) -> Referral:
    ref = Referral(
        referrer_id=referrer_id,
        referred_user_id=referred_user_id,
        bonus=bonus,
        has_paid=bonus > 0,
    )
    db.add(ref)
    await db.flush()
    return ref
