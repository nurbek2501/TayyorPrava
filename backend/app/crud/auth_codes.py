"""Pending registratsiya va Telegram tasdiq kodlari uchun repozitoriy."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.auth_code import AuthCode, PendingRegistration


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    """SQLite naive datetime'ni UTC deb belgilaymiz."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _gen_code() -> str:
    return f"{secrets.randbelow(100000):05d}"


# ---------------- Pending registration ----------------
async def upsert_pending(
    db: AsyncSession,
    *,
    nickname: str,
    first_name: str,
    last_name: str,
    password_hash: str,
    referred_by: Optional[str] = None,
) -> PendingRegistration:
    nick_lower = nickname.lower()
    existing = await db.get(PendingRegistration, nick_lower)
    if existing:
        existing.nickname_display = nickname
        existing.first_name = first_name
        existing.last_name = last_name
        existing.password_hash = password_hash
        existing.referred_by = referred_by
        existing.created_at = _now()
        await db.flush()
        return existing
    pending = PendingRegistration(
        nickname=nick_lower,
        nickname_display=nickname,
        first_name=first_name,
        last_name=last_name,
        password_hash=password_hash,
        referred_by=referred_by,
    )
    db.add(pending)
    await db.flush()
    return pending


async def get_pending(db: AsyncSession, nickname: str) -> Optional[PendingRegistration]:
    return await db.get(PendingRegistration, nickname.lower())


async def delete_pending(db: AsyncSession, nickname: str) -> None:
    await db.execute(
        delete(PendingRegistration).where(
            PendingRegistration.nickname == nickname.lower()
        )
    )


async def delete_codes_for_nickname(db: AsyncSession, nickname: str) -> None:
    """Nikka tegishli barcha tasdiq kodlarini o'chiradi (akkaunt o'chirilganda tozalash)."""
    await db.execute(delete(AuthCode).where(AuthCode.nickname == nickname.lower()))


# ---------------- Auth codes ----------------
async def create_code(
    db: AsyncSession,
    *,
    nickname: str,
    purpose: str,
    telegram_id: Optional[str],
    ttl_minutes: int,
) -> AuthCode:
    nick_lower = nickname.lower()
    # Avvalgi faol kodlarni bekor qilamiz (bitta nik uchun bitta amaldagi kod)
    await db.execute(
        update(AuthCode)
        .where(AuthCode.nickname == nick_lower, AuthCode.consumed.is_(False))
        .values(consumed=True)
    )
    code = AuthCode(
        nickname=nick_lower,
        code=_gen_code(),
        purpose=purpose,
        telegram_id=telegram_id,
        expires_at=_now() + timedelta(minutes=ttl_minutes),
    )
    db.add(code)
    await db.flush()
    return code


async def get_active_code(db: AsyncSession, nickname: str) -> Optional[AuthCode]:
    """Eng so'nggi amaldagi (ishlatilmagan, muddati o'tmagan) kod."""
    res = await db.execute(
        select(AuthCode)
        .where(AuthCode.nickname == nickname.lower(), AuthCode.consumed.is_(False))
        .order_by(AuthCode.created_at.desc())
    )
    for code in res.scalars().all():
        if _aware(code.expires_at) > _now():
            return code
    return None


async def get_valid_code(
    db: AsyncSession, nickname: str, code: str, purpose: str
) -> Optional[AuthCode]:
    active = await get_active_code(db, nickname)
    if active is None:
        return None
    if active.purpose != purpose:
        return None
    if active.code != (code or "").strip():
        active.attempts += 1
        # Juda ko'p xato urinish -> kodni kuydiramiz (brute-force himoyasi). Yangi kod
        # olish uchun foydalanuvchi qaytadan (Telegram orqali, rate-limitli) so'rashi kerak.
        if active.attempts >= settings.MAX_CODE_ATTEMPTS:
            active.consumed = True
        # COMMIT (flush emas): chaqiruvchi route bu None'da HTTPException tashlaydi va
        # sessiya commitsiz yopiladi -> flush qilingan hisob yo'qolardi. Commit uni saqlaydi.
        await db.commit()
        return None
    return active


async def consume_code(db: AsyncSession, code: AuthCode) -> None:
    code.consumed = True
    await db.flush()
