"""Rate limiting (slowapi) — brute-force / spam / scraping himoyasi.

Auth endpointlari IP bo'yicha cheklanadi (login, kod tasdiqlash, ro'yxat).
Savol (mashq) endpointlari foydalanuvchi bo'yicha cheklanadi (`questions_key`) —
bitta akkaunt daqiqasiga 20 dan ortiq savol so'rovi yubora olmaydi (scraping'ga qarshi).

Diqqat: /bot/issue-code LIMITLANMAYDI — u bitta bot-server IP'dan keladi va shared
secret bilan himoyalangan.

Storage: REDIS_URL berilsa Redis (ko'p worker uchun mos), aks holda jarayon-ichi
(in-memory). Strategiya — "moving-window" (haqiqiy sliding window).
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.security import decode_token


def _client_key(request: Request) -> str:
    """Foydalanuvchi IP'si. TRUST_FORWARDED_FOR=True (nginx ortida) bo'lsa
    X-Forwarded-For birinchi IP; aks holda (to'g'ridan-to'g'ri ochiq) haqiqiy peer IP —
    XFF soxtalashtirib rate-limit chetlab o'tilmasin."""
    if settings.TRUST_FORWARDED_FOR:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    return get_remote_address(request)


def _user_id(request: Request) -> str | None:
    """So'rovdagi bearer token'dan user id (imzo tekshirilgan)."""
    auth = request.headers.get("authorization", "")
    if len(auth) < 8 or auth[:7].lower() != "bearer ":
        return None
    payload = decode_token(auth[7:].strip())
    if not payload or payload.get("type") != "access":
        return None
    return payload.get("sub")


def questions_key(request: Request) -> str:
    """Savol endpointlari kaliti: foydalanuvchi bo'yicha (token), bo'lmasa IP bo'yicha.

    Shu sabab bitta akkaunt IP almashtirsa ham limitni chetlab o'tolmaydi.
    """
    uid = _user_id(request)
    return f"user:{uid}" if uid else f"ip:{_client_key(request)}"


limiter = Limiter(
    key_func=_client_key,
    enabled=settings.RATE_LIMIT_ENABLED,
    storage_uri=settings.REDIS_URL or "memory://",
    strategy="moving-window",
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 + Retry-After (oyna soniyasi). Toza JSON xabar qaytaradi.

    IP-manba (RATE_LIMIT_QUESTIONS_IP) limiti hit bo'lsa `x-ratelimit-scope: ip` sarlavhasi
    qo'yiladi — abuse-guard bu 429'ni akkaunt-eskalatsiyasidan istisno qiladi (bir NAT
    ortidagi boshqalarning umumiy trafigi halol foydalanuvchini bloklab qo'ymasin).
    """
    retry_after = 60
    scope = None
    try:
        retry_after = int(exc.limit.limit.get_expiry())  # limit oynasi (soniya)
    except Exception:
        pass
    try:
        # IP-limit boshqa (user) limitlardan farqli yagona miqdorga ega (300) — shu bilan
        # aniqlanadi. Agar IP-limit miqdorini o'zgartirsangiz — user limitlaridan farqli qoldiring.
        ip_amount = int(settings.RATE_LIMIT_QUESTIONS_IP.split("/")[0])
        if getattr(exc.limit.limit, "amount", None) == ip_amount:
            scope = "ip"
    except Exception:
        pass
    resp = JSONResponse(
        status_code=429,
        content={"detail": "Juda ko'p so'rov yuborildi. Birozdan keyin urinib ko'ring."},
    )
    resp.headers["Retry-After"] = str(retry_after)
    if scope:
        resp.headers["x-ratelimit-scope"] = scope
    return resp
