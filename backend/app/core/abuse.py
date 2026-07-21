"""Suiiste'mol/hujum aniqlash, avtomatik akkaunt bloki va xavfsizlik sarlavhalari.

Qatlamlar:
  1) Hujum imzolari (URL path+query): path-traversal, SQLi, XSS, skaner.
  2) Xulq hisobi (sliding-window): takroriy 429 (rate-limit) / 403 (taqiq).

IZOLYATSIYA — bir akkaunt suiiste'moli BOSHQALARGA ta'sir qilmaydi:
  * Tizimga kirgan hujum (token bor, masalan brauzer kengaytmasi) -> FAQAT shu akkaunt
    eskalatsiya bilan bloklanadi (5daq->15daq->admin). IP banlanmaydi -> bir xil IP'dagi
    (NAT / WiFi / mobil operator) boshqa foydalanuvchilar to'liq erkin qoladi.
  * Anonim hujum (token yo'q) -> IP ban, lekin u FAQAT anonim trafikni to'sadi;
    tizimga kirgan foydalanuvchilar (token bilan) ban'dan bemalol o'tadi.

Bloklangan akkaunt admin ochmaguncha (yoki eskalatsiya muddati tugaguncha) 403.
Adminlar (role=admin) avto-blokdan ozod. Holat in-memory (ko'p worker uchun Redis).
"""
from __future__ import annotations

import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from urllib.parse import unquote

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.logging import logger
from app.core.security import decode_token

# Hujum imzolari — bu app uchun normal trafikda deyarli uchramaydi (ID lar raqam/uuid).
_ATTACK_PATTERNS = (
    r"\.\./", r"\.\.\\", r"%2e%2e",
    r"/etc/(passwd|shadow)", r"/proc/self", r"file://",
    r"\bunion\b\s+\bselect\b", r"\binformation_schema\b",
    r"\bor\b\s+1\s*=\s*1", r"\bdrop\b\s+\btable\b", r"\binsert\b\s+\binto\b",
    r"sleep\s*\(", r"benchmark\s*\(", r"pg_sleep\s*\(",
    r"<script", r"onerror\s*=", r"onload\s*=", r"javascript:",
    r"/wp-(admin|login)", r"\.php(\?|$|/)", r"/\.env\b", r"/\.git/", r"phpmyadmin",
    r"xp_cmdshell", r"cmd\.exe", r"/bin/(ba)?sh",
)
_ATTACK_RE = re.compile("|".join(_ATTACK_PATTERNS), re.IGNORECASE)

_SKIP_PREFIXES = ("/docs", "/redoc")
_SKIP_EXACT = ("/openapi.json",)

# So'rov TANASINI (body) hujum imzosiga tekshirish — brauzer orqali (forma/API)
# yuborilgan zararli yuk (SQLi/XSS/injection) ham ushlanadi. Quyidagi yo'llarda
# tekshirilmaydi: auth (parol/nik erkin matn — noto'g'ri musbat bermasin),
# bot (shared-secret bilan himoyalangan), admin (savol matni erkin; adminlar blokdan ozod),
# ustoz chati (erkin matn/havolalar — moderatsiya alohida flag tizimi orqali).
_BODY_SCAN_SKIP_PREFIXES = (
    "/api/auth/", "/api/bot/", "/api/admin/", "/api/teachers/", "/api/teacher/",
)
# Faqat matnli tanalar tekshiriladi (fayl/multipart emas) va shu hajmgacha (DoS'siz).
_BODY_SCAN_TYPES = ("application/json", "application/x-www-form-urlencoded", "text/")
_MAX_SCAN_BYTES = 256 * 1024

# Sliding-window hodisalar (key -> timestamps) va IP banlar (ip -> tugash vaqti)
_events: dict[str, deque] = defaultdict(deque)
_banned_ips: dict[str, float] = {}
# Scraping anomaliyasi: user -> deque[(ts, resurs)] — oynada nechta TURLI topic/ticket
_scrape_access: dict[str, deque] = defaultdict(deque)
# Umumiy hajm: user -> deque[(ts, count)] — oynada berilgan JAMI savollar soni.
_served: dict[str, deque] = defaultdict(deque)
# Javob-kaliti: user -> deque[(ts, question_id)] — oynada javobi so'ralgan TURLI savollar.
_answer_reveal: dict[str, deque] = defaultdict(deque)

_TOPIC_Q_RE = re.compile(r"^/api/topics/(\d+)/questions$")
_TICKET_Q_RE = re.compile(r"^/api/tickets/(\d+)/questions$")


def _question_resource(path: str) -> str | None:
    """So'rov yo'lidan topic/ticket resursini ajratadi (anomaliya hisobi uchun)."""
    m = _TOPIC_Q_RE.match(path)
    if m:
        return f"topic:{m.group(1)}"
    m = _TICKET_Q_RE.match(path)
    if m:
        return f"ticket:{m.group(1)}"
    return None


def record_resource_access(user_id: str, resource: str, window: int) -> int:
    """Foydalanuvchi oynada nechta TURLI resurs (topic/ticket) so'raganini qaytaradi.

    Bitta mavzuni sahifalab so'rash (offset) bir resurs deb hisoblanadi — normal mashq
    anomaliya bo'lib qolmaydi; faqat KO'P TURLI mavzu skanerlash bloklanadi.
    """
    now = time.time()
    dq = _scrape_access[user_id]
    dq.append((now, resource))
    cutoff = now - window
    while dq and dq[0][0] < cutoff:
        dq.popleft()
    if not dq:
        _scrape_access.pop(user_id, None)  # xotira tejash (bo'sh kalitlarni tashlab)
    return len({r for _, r in dq})


def record_served(user_id: str, count: int, window: int) -> int:
    """Oynada foydalanuvchiga berilgan JAMI savollar sonini qaytaradi."""
    now = time.time()
    dq = _served[user_id]
    dq.append((now, count))
    cutoff = now - window
    while dq and dq[0][0] < cutoff:
        dq.popleft()
    return sum(c for _, c in dq)


def record_answer_reveal(user_id: str, question_id: str, window: int) -> int:
    """Oynada javobi (to'g'ri variant) so'ralgan TURLI savollar sonini qaytaradi."""
    now = time.time()
    dq = _answer_reveal[user_id]
    dq.append((now, question_id))
    cutoff = now - window
    while dq and dq[0][0] < cutoff:
        dq.popleft()
    return len({q for _, q in dq})


async def guard_serve(user_id: str | None, count: int) -> None:
    """Savol berilgach chaqiriladi — hajm anomaliyasi bo'lsa akkauntni bloklaydi.

    Chegaralar mavjud rate-limitlar ustidan yana bir qatlam: ko'p endpoint bo'ylab
    (topic/ticket/random/id/smart) yig'ilgan hajm ham nazoratga tushadi.
    """
    if not settings.ABUSE_GUARD_ENABLED or not user_id or count <= 0:
        return
    total = record_served(user_id, count, settings.SERVE_SCRAPE_WINDOW)
    if total >= settings.SERVE_SCRAPE_MAX:
        await block_user(
            user_id,
            f"Scraping anomaliyasi: {settings.SERVE_SCRAPE_WINDOW}s ichida {total} savol olindi",
        )


async def guard_answer(user_id: str | None, question_id: str) -> None:
    """Javob (to'g'ri variant) oshkor qilingach chaqiriladi — javob-kaliti bulk
    ekstraksiyasi bo'lsa akkauntni bloklaydi."""
    if not settings.ABUSE_GUARD_ENABLED or not user_id or not question_id:
        return
    distinct = record_answer_reveal(
        user_id, question_id, settings.ANSWER_REVEAL_WINDOW
    )
    if distinct >= settings.ANSWER_REVEAL_MAX:
        await block_user(
            user_id,
            f"Javob-kaliti scraping: {settings.ANSWER_REVEAL_WINDOW}s ichida "
            f"{distinct} turli savol javobi so'raldi",
        )

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Permitted-Cross-Domain-Policies": "none",
    # Brauzer imkoniyatlarini cheklaydi (bu API'ga hech biri kerak emas).
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), usb=(), payment=()",
    # HTTPS'da brauzer HTTP'ga tushmaydi (HTTP'da brauzer e'tiborsiz qoldiradi).
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
}
_NO_CSP_PATHS = ("/docs", "/redoc")


def reset_state() -> None:
    """Test izolyatsiyasi uchun ichki holatni tozalaydi."""
    _events.clear()
    _banned_ips.clear()
    _scrape_access.clear()
    _served.clear()
    _answer_reveal.clear()


def client_ip(request: Request) -> str:
    """To'g'ri mijoz IP'si.

    TRUST_FORWARDED_FOR=True (nginx ortida) — X-Forwarded-For birinchi qiymati.
    To'g'ridan-to'g'ri ochiq bo'lsa (False) XFF'ga ishonmaymiz (soxtalashtirib
    IP-ban/rate-limit chetlab o'tilmasin) — haqiqiy peer IP olinadi.
    """
    if settings.TRUST_FORWARDED_FOR:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _record(key: str, weight: int, window: int) -> int:
    now = time.time()
    dq = _events[key]
    dq.extend([now] * max(1, weight))
    cutoff = now - window
    while dq and dq[0] < cutoff:
        dq.popleft()
    n = len(dq)
    if n == 0:
        _events.pop(key, None)  # xotira tejash (bo'sh kalitlarni tashlab yuboramiz)
    return n


def is_ip_banned(ip: str) -> bool:
    exp = _banned_ips.get(ip)
    if exp is None:
        return False
    if exp < time.time():
        _banned_ips.pop(ip, None)
        return False
    return True


def ban_ip(ip: str, seconds: int) -> None:
    _banned_ips[ip] = time.time() + seconds
    logger.warning("IP vaqtincha banlandi: %s (%ss)", ip, seconds)


def _token_user_id(request: Request) -> str | None:
    """So'rovdagi bearer token'dan user id (imzo tekshirilgan). Yo'q/yaroqsiz -> None."""
    auth = request.headers.get("authorization", "")
    if len(auth) < 8 or auth[:7].lower() != "bearer ":
        return None
    payload = decode_token(auth[7:].strip())
    if not payload or payload.get("type") != "access":
        return None
    return payload.get("sub")


async def block_user(user_id: str, cause: str) -> int:
    """Akkauntni ESKALATSIYA bilan bloklaydi (faqat role=user, hali bloklanmagan).

    1-marta -> 5 daq, 2-marta -> 15 daq, 3-marta va keyin -> faqat admin ochadi.
    Qaytaradi: yangi blok darajasi (0 = bloklanmadi). Xato yutiladi.
    """
    from datetime import timedelta

    from app.crud import users as users_crud
    from app.db.session import AsyncSessionLocal
    from app.models.enums import Role

    try:
        async with AsyncSessionLocal() as db:
            user = await users_crud.get_user_by_id(db, user_id)
            if user is None or user.role == Role.admin or user.is_blocked:
                return 0
            level = int(user.block_count or 0) + 1
            now = datetime.now(timezone.utc)
            if level == 1:
                secs = settings.ABUSE_BLOCK_1_SECONDS
            elif level == 2:
                secs = settings.ABUSE_BLOCK_2_SECONDS
            else:
                secs = None  # admin ochishi shart
            user.is_blocked = True
            user.block_count = level
            user.blocked_at = now
            user.block_until = (now + timedelta(seconds=secs)) if secs else None
            if secs:
                mins = secs // 60
                user.block_reason = (
                    f"Shubhali faollik aniqlandi — akkaunt {mins} daqiqaga bloklandi "
                    f"({level}-ogohlantirish). Sabab: {cause}"
                )[:255]
            else:
                user.block_reason = (
                    f"Takroriy hujum ({level}-marta) — akkaunt bloklandi. "
                    f"Faqat administrator ochadi. Sabab: {cause}"
                )[:255]
            await db.commit()
        logger.warning(
            "AVTO-BLOK: akkaunt=%s daraja=%s muddat=%ss sabab=%s",
            user_id, level, secs, cause,
        )
        return level
    except Exception:
        logger.exception("Avto-blok DB xatosi: akkaunt=%s", user_id)
        return 0


def _secure(resp: Response, path: str = "") -> Response:
    for k, v in _SECURITY_HEADERS.items():
        resp.headers.setdefault(k, v)
    # CSP — API/JSON uchun qattiq; Swagger /docs (HTML+CDN) ni buzmaslik uchun ozod.
    if not (path.startswith(_NO_CSP_PATHS) or path == "/openapi.json"):
        resp.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        )
    return resp


def _forbidden(detail: str) -> JSONResponse:
    return _secure(JSONResponse(status_code=403, content={"detail": detail}))


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    """Content-Length juda katta so'rovlarni tanani o'qimasdan erta rad etadi (DoS himoyasi)."""

    def __init__(self, app, max_bytes: int):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl:
            try:
                if int(cl) > self.max_bytes:
                    logger.warning(
                        "So'rov tanasi juda katta: %s bayt (limit %s), yo'l=%s",
                        cl, self.max_bytes, request.url.path,
                    )
                    return _secure(
                        JSONResponse(
                            status_code=413,
                            content={"detail": "So'rov hajmi juda katta"},
                        ),
                        request.url.path,
                    )
            except ValueError:
                pass
        return await call_next(request)


class AbuseGuardMiddleware(BaseHTTPMiddleware):
    """Har bir so'rovni tekshiradi: hujum imzosi, banlangan IP, xulq hisobi."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (
            not settings.ABUSE_GUARD_ENABLED
            or path.startswith(_SKIP_PREFIXES)
            or path in _SKIP_EXACT
        ):
            return _secure(await call_next(request), path)

        ip = client_ip(request)
        uid = _token_user_id(request)  # imzo-tekshirilgan token bo'lsa — user id

        # 1) IP ban FAQAT anonim (token'siz) so'rovlarni to'sadi. Tizimga kirgan
        #    foydalanuvchilar (token bor) IP bandan ta'sirlanmaydi — ularning taqdiri
        #    faqat SHAXSIY akkaunt-blok orqali hal qilinadi (bir xil IP'dagi boshqa
        #    akkauntlar — NAT/WiFi/mobil operator — to'liq erkin qoladi).
        if uid is None and is_ip_banned(ip):
            return _forbidden("Shubhali faollik — kirish vaqtincha bloklandi.")

        # 2) Hujum imzosi (path + query, URL-dekodlangan)
        raw = f"{path}?{request.url.query}" if request.url.query else path
        if _ATTACK_RE.search(unquote(raw)):
            logger.warning("HUJUM imzosi: ip=%s yo'l=%s akkaunt=%s", ip, raw, uid)
            if uid:
                # Tizimga kirgan hujum (masalan brauzer kengaytmasi) — FAQAT shu akkaunt
                # eskalatsiya bilan bloklanadi. IP BANLANMAYDI -> boshqalar erkin.
                await block_user(uid, "Hujum imzosi: so'rovda zararli namuna")
                return _forbidden("Zararli so'rov aniqlandi — akkaunt bloklandi.")
            # Anonim hujum — akkaunt yo'q. IP banlanadi (faqat anonim trafikni to'sadi).
            ban_ip(ip, settings.ABUSE_BAN_SECONDS)
            return _forbidden("Zararli so'rov aniqlandi — kirish bloklandi.")

        # 2b) Hujum imzosi — so'rov TANASIDA (brauzer orqali forma/API bilan yuborilgan
        #     zararli yuk). Matnli, hajmi cheklangan tanalar; auth/bot/admin tekshirilmaydi.
        if (
            request.method in ("POST", "PUT", "PATCH")
            and not path.startswith(_BODY_SCAN_SKIP_PREFIXES)
            and request.headers.get("content-type", "").startswith(_BODY_SCAN_TYPES)
        ):
            try:
                body = await request.body()  # keshlanadi -> handler qayta o'qiy oladi
            except Exception:
                body = b""
            if body and len(body) <= _MAX_SCAN_BYTES:
                text = unquote(body.decode("utf-8", "ignore"))
                if _ATTACK_RE.search(text):
                    logger.warning(
                        "HUJUM imzosi (tana): ip=%s yo'l=%s akkaunt=%s", ip, path, uid
                    )
                    if uid:
                        await block_user(
                            uid, "Hujum imzosi: so'rov tanasida zararli namuna"
                        )
                        return _forbidden("Zararli so'rov aniqlandi — akkaunt bloklandi.")
                    ban_ip(ip, settings.ABUSE_BAN_SECONDS)
                    return _forbidden("Zararli so'rov aniqlandi — kirish bloklandi.")

        # 3) So'rovni bajaramiz
        response = await call_next(request)

        # 4) Xulq hisobi: kirgan foydalanuvchi -> AKKAUNT hisobi (IP emas);
        #    anonim -> IP hisobi. Shunday qilib akkaunt suiiste'moli hech qachon
        #    boshqa foydalanuvchilarga (bir xil IP) ta'sir qilmaydi.
        code = response.status_code
        # Tarif "paywall" 403'i — kutilgan xulq, suiiste'mol emas (hisobga olinmaydi).
        is_paywall = code == 403 and response.headers.get("x-content-gate") == "tariff"
        # IP-manba rate-limit 429'i — bir NAT ortidagi UMUMIY trafik natijasi, aybdor
        # foydalanuvchining o'zi emas. Akkaunt/IP eskalatsiyasiga kiritilmaydi (aks holda
        # halol o'quvchi boshqalarning yuki sabab bloklanardi).
        is_ip_rl = code == 429 and response.headers.get("x-ratelimit-scope") == "ip"
        if code in (429, 403) and not is_paywall and not is_ip_rl:
            weight = 3 if code == 429 else 2
            if uid:
                score = _record(f"user:{uid}", weight, settings.ABUSE_WINDOW_SECONDS)
                if score >= settings.ABUSE_USER_THRESHOLD:
                    await block_user(uid, f"Shubhali faollik: takroriy {code} javob")
            elif (
                _record(f"ip:{ip}", weight, settings.ABUSE_WINDOW_SECONDS)
                >= settings.ABUSE_IP_THRESHOLD
            ):
                ban_ip(ip, settings.ABUSE_BAN_SECONDS)
        elif code == 401 and path.endswith("/auth/login"):
            # Login anonim oqim — parol bruteforce -> IP hisobi (faqat anonim trafikni to'sadi).
            if (
                _record(f"ip:{ip}", 2, settings.ABUSE_WINDOW_SECONDS)
                >= settings.ABUSE_IP_THRESHOLD
            ):
                ban_ip(ip, settings.ABUSE_BAN_SECONDS)

        # 5) Scraping anomaliyasi: kirgan foydalanuvchi qisqa vaqtda ko'p TURLI
        #    mavzu/biletni muvaffaqiyatli (200) so'rasa -> eskalatsion blok (mavjud mexanizm).
        if uid and code == 200:
            resource = _question_resource(path)
            if resource:
                distinct = record_resource_access(
                    uid, resource, settings.SCRAPE_WINDOW_SECONDS
                )
                if distinct >= settings.SCRAPE_DISTINCT_TOPICS:
                    await block_user(
                        uid,
                        f"Scraping anomaliyasi: {settings.SCRAPE_WINDOW_SECONDS}s ichida "
                        f"{distinct} turli mavzu/bilet so'raldi",
                    )

        return _secure(response, path)
