"""Password hashing (bcrypt), JWT token va Telegram Login Widget imzo tekshiruvi."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# bcrypt has a hard 72-byte limit on the input password.
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    pw = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        pw = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
        return bcrypt.checkpw(pw, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# bcrypt CPU-band va sekin. Async so'rovda to'g'ridan-to'g'ri chaqirilsa — butun
# event loop bloklanadi (boshqa barcha so'rovlar kutadi). Shuning uchun login/
# register kabi oqimlarda quyidagi threadpool variantlari ishlatiladi.
async def hash_password_async(password: str) -> str:
    return await asyncio.to_thread(hash_password, password)


async def verify_password_async(password: str, hashed: str) -> bool:
    return await asyncio.to_thread(verify_password, password, hashed)


def _create_token(subject: str, role: str, token_type: str, expires: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: str, role: str) -> str:
    return _create_token(
        subject,
        role,
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: str, role: str) -> str:
    return _create_token(
        subject,
        role,
        "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def verify_telegram_login(
    data: dict[str, Any], bot_token: str, max_age_seconds: int
) -> bool:
    """Telegram Login Widget berdan ma'lumot/hash'ni tekshiradi (rasmiy algoritm).

    https://core.telegram.org/widgets/login#checking-authorization
    `data` — FAQAT Telegram imzolagan maydonlar (masalan `ref` kabi bizning
    qo'shimcha parametrlarimiz kirmasligi shart, aks holda hash hech qachon mos kelmaydi).
    """
    if not bot_token:
        return False
    received_hash = data.get("hash")
    if not isinstance(received_hash, str) or not received_hash:
        return False
    check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data.items()) if k != "hash" and v is not None
    )
    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
    computed = hmac.new(
        secret_key, check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(computed, received_hash):
        return False
    try:
        auth_date = int(data.get("auth_date", 0))
    except (TypeError, ValueError):
        return False
    return (time.time() - auth_date) <= max_age_seconds
