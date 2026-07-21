"""Integration tests hitting the FastAPI app via httpx ASGI transport.

Assumes the database has been seeded (`python -m app.seed`).
"""
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app

BASE = "http://test"


@pytest_asyncio.fixture
async def api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE) as client:
        yield client


@pytest.fixture(autouse=True)
def _reset_guards():
    """Har test oldidan rate-limit va abuse holatini tozalaydi (test izolyatsiyasi)."""
    from app.core.abuse import reset_state
    from app.core.ratelimit import limiter

    limiter.reset()
    reset_state()
    yield


async def _auth_user(api: AsyncClient) -> dict:
    """Joriy nickname-asosli ro'yxat oqimi: register-init -> bot kod -> verify-code."""
    nick = "Test" + uuid.uuid4().hex[:6].upper() + "9"  # 8+ alnum, katta harf + raqam
    tg = "tg" + uuid.uuid4().hex[:10]
    r = await api.post(
        "/api/auth/register-init",
        json={
            "firstName": "Test",
            "lastName": "User",
            "nickname": nick,
            "password": "Test1234",
        },
    )
    assert r.status_code == 200, r.text
    # Bot (shared secret bilan) 5 xonali kod beradi
    r = await api.post(
        "/api/bot/issue-code",
        json={"nickname": nick, "telegramId": tg},
        headers={"X-Bot-Secret": settings.BOT_SHARED_SECRET},
    )
    assert r.status_code == 200, r.text
    code = r.json()["code"]
    r = await api.post("/api/auth/verify-code", json={"nickname": nick, "code": code})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


async def _auth_admin(api: AsyncClient) -> dict:
    """Testlar uchun MUSTAQIL admin hisobi — haqiqiy 'admin' akkauntiga BOG'LIQ EMAS.

    Haqiqiy admin endi AdminSettings > "Mening hisobim" orqali o'z login/parolini
    o'zgartira oladi, shuning uchun uni qattiq yozib qo'yish (login="admin") mo'rt edi.
    Idempotent: birinchi chaqiruvda yaratadi, keyingilarida mavjudini ishlatadi.
    """
    from sqlalchemy import select

    from app.core.security import hash_password
    from app.db.session import AsyncSessionLocal
    from app.models.enums import Role
    from app.models.user import User

    login = "pytest_admin_fixture"
    password = "PytestAdmin123"
    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(select(User).where(User.phone == login))
        ).scalar_one_or_none()
        if existing is None:
            db.add(
                User(
                    name="Pytest Admin",
                    phone=login,
                    password_hash=hash_password(password),
                    role=Role.admin,
                )
            )
            await db.commit()

    r = await api.post(
        "/api/admin/auth/login", json={"login": login, "password": password}
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


async def _give_subscription(uid: str) -> None:
    """Test foydalanuvchisiga aktiv obuna beradi (to'liq kontent kirishi uchun)."""
    from datetime import datetime, timedelta, timezone

    from app.db.session import AsyncSessionLocal
    from app.models.user import Subscription

    async with AsyncSessionLocal() as db:
        db.add(
            Subscription(
                user_id=uid,
                expires_at=datetime.now(timezone.utc) + timedelta(days=30),
                is_active=True,
            )
        )
        await db.commit()


async def _auth_paid_user(api: AsyncClient) -> dict:
    """Aktiv tarifi bor foydalanuvchi (butun savol bazasiga kirish)."""
    headers = await _auth_user(api)
    uid = (await api.get("/api/auth/me", headers=headers)).json()["id"]
    await _give_subscription(uid)
    return headers


async def test_health(api):
    r = await api.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_security_headers(api):
    r = await api.get("/api/health")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"
    assert "max-age" in (r.headers.get("strict-transport-security") or "")
    assert "default-src 'none'" in (r.headers.get("content-security-policy") or "")


async def test_topics_require_auth(api):
    # Test bazasi qulflangan — token'siz 401
    r = await api.get("/api/topics")
    assert r.status_code == 401
    # Token bilan — 200
    headers = await _auth_user(api)
    r = await api.get("/api/topics", headers=headers)
    assert r.status_code == 200
    topics = r.json()
    assert len(topics) >= 42
    assert {"id", "nameUz", "nameRu", "questionCount"} <= set(topics[0].keys())


async def test_tariffs_public_methods_locked(api):
    # Narxlar (tariflar) guest landing uchun ochiq qoladi
    r = await api.get("/api/tariffs")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    # To'lov usullari endi token talab qiladi
    r = await api.get("/api/payment-methods")
    assert r.status_code == 401
    headers = await _auth_user(api)
    r = await api.get("/api/payment-methods", headers=headers)
    assert r.status_code == 200
    codes = {m["code"] for m in r.json()}
    assert "payme" in codes


async def test_content_endpoints_locked(api):
    """Test bazasi (topics/tickets/road-signs/payment-methods) token'siz YOPIQ."""
    locked = ["/api/topics", "/api/tickets", "/api/road-signs", "/api/payment-methods"]
    for path in locked:
        r = await api.get(path)
        assert r.status_code == 401, (path, r.status_code)
    headers = await _auth_user(api)
    for path in locked:
        r = await api.get(path, headers=headers)
        # Token bilan — endi qulf yo'q (road-signs data bo'lmasa 404 bo'lishi mumkin, lekin 401 emas)
        assert r.status_code != 401, (path, r.status_code)


async def test_answer_key_never_in_question_responses(api):
    """#5: correctOptionId/isCorrect HECH QACHON savol endpointlari javobida bo'lmaydi."""
    import json as _json

    headers = await _auth_paid_user(api)
    paths = [
        "/api/random-questions?count=3",
        "/api/topics/1/questions",
        "/api/tickets/1/questions",
    ]
    for p in paths:
        body = _json.dumps((await api.get(p, headers=headers)).json())
        assert "correctOptionId" not in body and "isCorrect" not in body, p
    q = (await api.get("/api/random-questions?count=1", headers=headers)).json()[0]
    body = _json.dumps((await api.get(f"/api/questions/{q['id']}", headers=headers)).json())
    assert "correctOptionId" not in body and "isCorrect" not in body


async def test_options_shuffled(api):
    """#7: variantlar har so'rovda aralashtiriladi (javob pozitsiyasi yodlanmaydi)."""
    headers = await _auth_paid_user(api)
    qid = (await api.get("/api/random-questions?count=1", headers=headers)).json()[0]["id"]
    orders = set()
    for _ in range(10):
        r = await api.get(f"/api/questions/{qid}", headers=headers)
        orders.add(tuple(o["id"] for o in r.json()["options"]))
    assert len(orders) > 1, "variantlar aralashtirilmagan"


async def test_question_pagination(api):
    """Savol endpointi to'liq mavzuni birdaniga qaytarmaydi — limit (max 20) + offset."""
    headers = await _auth_paid_user(api)
    # limit > max -> 20 ga cheklanadi (bilet 1 da 20 savol bor)
    r = await api.get("/api/tickets/1/questions", params={"limit": 100}, headers=headers)
    assert r.status_code == 200 and len(r.json()) <= 20
    # aniq limit
    r = await api.get("/api/tickets/1/questions", params={"limit": 5}, headers=headers)
    assert len(r.json()) == 5
    # Topic (barqaror tartib) — offset boshqa partiyani beradi (yetarli savol bo'lsa)
    p1 = (
        await api.get("/api/topics/1/questions", params={"limit": 5, "offset": 0}, headers=headers)
    ).json()
    p2 = (
        await api.get("/api/topics/1/questions", params={"limit": 5, "offset": 5}, headers=headers)
    ).json()
    if p1 and p2:
        assert {q["id"] for q in p1}.isdisjoint({q["id"] for q in p2})


async def test_question_endpoints_rate_limited(api):
    """Savol endpointlari 20/min (foydalanuvchi bo'yicha) — 21-so'rov 429 + Retry-After."""
    headers = await _auth_user(api)
    statuses = []
    for _ in range(21):
        r = await api.get("/api/random-questions", params={"count": 1}, headers=headers)
        statuses.append(r.status_code)
    assert statuses.count(200) == 20, statuses
    assert statuses[-1] == 429, statuses
    # 429 javobida Retry-After header bo'lishi kerak
    r = await api.get("/api/random-questions", params={"count": 1}, headers=headers)
    assert r.status_code == 429
    assert r.headers.get("retry-after") is not None


async def test_free_user_full_access(api):
    """Sayt tekin: obunasiz foydalanuvchi ham barcha mavzu/biletlarga kiradi
    (faqat real imtihon pullik — u alohida /real-exam oqimida)."""
    from app.core.abuse import reset_state

    reset_state()
    headers = await _auth_user(api)  # yangi user -> obunasiz
    assert (await api.get("/api/topics/1/questions", headers=headers)).status_code == 200
    assert (await api.get("/api/topics/10/questions", headers=headers)).status_code == 200
    assert (await api.get("/api/tickets/1/questions", headers=headers)).status_code == 200
    assert (await api.get("/api/tickets/10/questions", headers=headers)).status_code == 200
    reset_state()


async def test_scraping_anomaly_blocks_account(api):
    """60s ichida 10+ turli topic so'rash -> scraping anomaliyasi -> akkaunt bloki."""
    from app.core.abuse import reset_state

    reset_state()
    headers = await _auth_paid_user(api)  # to'liq kirish (aks holda paywall, scraping emas)
    statuses = []
    for tid in range(1, 12):  # 11 turli topic
        r = await api.get(f"/api/topics/{tid}/questions", headers=headers)
        statuses.append(r.status_code)
    # 10-turli resursdan keyin akkaunt bloklanadi -> keyingi so'rov(lar) 403
    assert 403 in statuses, statuses
    # /me ham endi 403 (akkaunt bloklangan) — toza IP'dan ham
    r = await api.get("/api/auth/me", headers={**headers, "X-Forwarded-For": "198.51.100.77"})
    assert r.status_code == 403
    reset_state()


async def test_practice_hides_answers_then_check(api):
    """Mashq rejimida to'g'ri javob OSHKOR bo'lmaydi; /check-answer orqali tekshiriladi."""
    headers = await _auth_paid_user(api)
    r = await api.get("/api/random-questions", params={"count": 5}, headers=headers)
    assert r.status_code == 200, r.text
    qs = r.json()
    assert qs, "mashq savollari bo'lishi kerak"
    q = qs[0]
    # To'g'ri javob/izoh berilmaydi
    assert "explanation" not in q
    for o in q["options"]:
        assert "isCorrect" not in o, "mashqda to'g'ri javob oshkor bo'lmasligi kerak"
    # Server tekshiruvi -> to'g'ri javobni qaytaradi
    r = await api.post(
        "/api/check-answer",
        json={"questionId": q["id"], "optionId": q["options"][0]["id"]},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data["isCorrect"], bool)
    assert data["correctOptionId"]
    # To'g'ri javobni tanlash -> isCorrect True
    r = await api.post(
        "/api/check-answer",
        json={"questionId": q["id"], "optionId": data["correctOptionId"]},
        headers=headers,
    )
    assert r.json()["isCorrect"] is True


async def test_auto_block_on_attack_signature(api):
    """Hujum imzosi (token bilan) -> akkaunt avto-bloklanadi -> admin ochmaguncha 403."""
    from app.core.abuse import reset_state

    reset_state()
    headers = await _auth_user(api)
    uid = (await api.get("/api/auth/me", headers=headers)).json()["id"]

    # Hujum imzoli so'rov (alohida IP — testclient IP'si banlanmasin)
    atk = {**headers, "X-Forwarded-For": "203.0.113.7"}
    r = await api.get("/api/topics", params={"x": "../../etc/passwd"}, headers=atk)
    assert r.status_code == 403, r.text

    # Endi oddiy so'rov ham 403 — akkaunt bloklangan (boshqa, toza IP'dan)
    r = await api.get("/api/auth/me", headers={**headers, "X-Forwarded-For": "198.51.100.5"})
    assert r.status_code == 403

    # Admin ochadi -> yana ishlaydi
    admin = await _auth_admin(api)
    r = await api.patch(
        f"/api/admin/users/{uid}",
        json={"isBlocked": False},
        headers={**admin, "X-Forwarded-For": "198.51.100.6"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["isBlocked"] is False
    r = await api.get("/api/auth/me", headers={**headers, "X-Forwarded-For": "198.51.100.7"})
    assert r.status_code == 200
    reset_state()


async def test_auto_block_escalation(api):
    """Eskalatsiya: 1-hujum -> 5 daq, 2-hujum -> 15 daq, 3-hujum -> faqat admin ochadi."""
    from datetime import datetime, timedelta, timezone

    from app.core.abuse import reset_state
    from app.crud import users as users_crud
    from app.db.session import AsyncSessionLocal

    reset_state()
    headers = await _auth_user(api)
    uid = (await api.get("/api/auth/me", headers=headers)).json()["id"]

    async def attack(ip):
        return await api.get(
            "/api/topics",
            params={"x": "../../etc/passwd"},
            headers={**headers, "X-Forwarded-For": ip},
        )

    async def state():
        async with AsyncSessionLocal() as db:
            u = await users_crud.get_user_by_id(db, uid)
            return u.block_count, u.is_blocked, u.block_until

    async def expire():
        async with AsyncSessionLocal() as db:
            u = await users_crud.get_user_by_id(db, uid)
            u.block_until = datetime.now(timezone.utc) - timedelta(seconds=1)
            await db.commit()

    async def me(ip):
        return await api.get("/api/auth/me", headers={**headers, "X-Forwarded-For": ip})

    # 1-hujum -> 5 daqiqa blok
    assert (await attack("203.0.113.21")).status_code == 403
    cnt, blocked, until = await state()
    assert cnt == 1 and blocked and until is not None
    assert (await me("198.51.100.21")).status_code == 403  # bloklangan
    await expire()
    assert (await me("198.51.100.22")).status_code == 200  # muddat tugadi -> avto-ochildi

    # 2-hujum -> 15 daqiqa blok
    assert (await attack("203.0.113.22")).status_code == 403
    cnt, blocked, until = await state()
    assert cnt == 2 and blocked and until is not None
    await expire()
    assert (await me("198.51.100.23")).status_code == 200

    # 3-hujum -> faqat admin ochadi (block_until = None)
    assert (await attack("203.0.113.23")).status_code == 403
    cnt, blocked, until = await state()
    assert cnt == 3 and blocked and until is None

    # Admin ochadi -> toza varaq (block_count = 0), yana ishlaydi
    admin = await _auth_admin(api)
    r = await api.patch(
        f"/api/admin/users/{uid}",
        json={"isBlocked": False},
        headers={**admin, "X-Forwarded-For": "198.51.100.30"},
    )
    assert r.status_code == 200 and r.json()["isBlocked"] is False
    cnt, blocked, until = await state()
    assert cnt == 0 and not blocked
    assert (await me("198.51.100.31")).status_code == 200
    reset_state()


async def test_auto_block_on_body_attack(api):
    """Brauzer orqali so'rov TANASIDA hujum (SQLi/XSS) -> akkaunt avto-bloklanadi."""
    from app.core.abuse import reset_state

    reset_state()
    headers = await _auth_user(api)

    # Zararli yuk so'rov tanasida (auth/admin emas -> tekshiriladi). Alohida IP —
    # akkaunt bloklanadi (IP emas), lekin testclient IP'si toza qolsin.
    atk = {**headers, "X-Forwarded-For": "203.0.113.41"}
    r = await api.post(
        "/api/me/favorites",
        json={"questionId": "x", "q": "1 UNION SELECT password FROM users"},
        headers=atk,
    )
    assert r.status_code == 403, r.text
    assert "blok" in r.json()["detail"].lower()

    # Akkaunt bloklangan -> toza IP'dan oddiy so'rov ham 403 (darhol chiqariladi)
    r = await api.get(
        "/api/auth/me", headers={**headers, "X-Forwarded-For": "198.51.100.41"}
    )
    assert r.status_code == 403
    reset_state()


async def test_body_scan_skips_auth_passwords(api):
    """Parol maydonidagi maxsus belgilar ('or 1=1') noto'g'ri blok BERMAYDI.

    Auth endpointlari tana-skanidan ozod -> login 401 (noto'g'ri parol), 403 EMAS.
    Bu sayt normal ishlashini (noto'g'ri musbatsiz) kafolatlaydi.
    """
    from app.core.abuse import reset_state

    reset_state()
    r = await api.post(
        "/api/auth/login",
        json={"nickname": "NoSuchUser9", "password": "x' or 1=1 --"},
        headers={"X-Forwarded-For": "203.0.113.51"},
    )
    assert r.status_code == 401, r.text  # noto'g'ri parol — blok/ban EMAS
    reset_state()


async def test_favorites_invalid_question_404(api):
    """Mavjud bo'lmagan question_id -> 404 (avval FK IntegrityError -> 500 edi)."""
    headers = await _auth_user(api)
    r = await api.post(
        "/api/me/favorites", json={"questionId": "no-such-id"}, headers=headers
    )
    assert r.status_code == 404, r.text
    r = await api.post(
        "/api/me/mistakes", json={"questionId": "no-such-id"}, headers=headers
    )
    assert r.status_code == 404, r.text


async def test_payment_paid_grants_subscription(api):
    """To'lov 'paid' bo'lganda -> obuna beriladi (profil subscriptionActive=true)."""
    headers = await _auth_user(api)
    me = (await api.get("/api/auth/me", headers=headers)).json()
    assert me["subscriptionActive"] is False
    tariffs = (await api.get("/api/tariffs")).json()
    if not tariffs:
        # Tekin-kontent modelida barcha tariflar o'chirilgan bo'lishi mumkin — bunda
        # to'lov->obuna KODI sinovining sharti bajarilmaydi (mahsulot qarori), shuning
        # uchun o'tkazib yuboramiz (kodda xato emas). Faol tarif bo'lsa — to'liq sinaladi.
        import pytest

        pytest.skip("Faol tarif yo'q (tekin-kontent modeli) — to'lov->obuna sinovi o'tkazib yuborildi")
    tid = tariffs[0]["id"]
    pay = await api.post(
        "/api/payments",
        json={"tariffId": tid, "method": "click", "phone": "+998900000000"},
        headers=headers,
    )
    assert pay.status_code == 201, pay.text
    pid = pay.json()["id"]
    admin = await _auth_admin(api)
    upd = await api.patch(
        f"/api/admin/payments/{pid}", json={"status": "paid"}, headers=admin
    )
    assert upd.status_code == 200, upd.text
    # Endi obuna faol
    me = (await api.get("/api/auth/me", headers=headers)).json()
    assert me["subscriptionActive"] is True


async def test_auth_code_bruteforce_cap(api):
    """Kodni MAX_CODE_ATTEMPTS marta xato kiritish -> kod kuyadi (to'g'ri kod ham ishlamaydi)."""
    nick = "Brute" + uuid.uuid4().hex[:6].upper() + "9"
    await api.post(
        "/api/auth/register-init",
        json={"firstName": "A", "lastName": "B", "nickname": nick, "password": "Test1234"},
    )
    r = await api.post(
        "/api/bot/issue-code",
        json={"nickname": nick, "telegramId": "tg" + uuid.uuid4().hex[:8]},
        headers={"X-Bot-Secret": settings.BOT_SHARED_SECRET},
    )
    code = r.json()["code"]
    wrong = "00000" if code != "00000" else "11111"
    for _ in range(settings.MAX_CODE_ATTEMPTS):
        rr = await api.post("/api/auth/verify-code", json={"nickname": nick, "code": wrong})
        assert rr.status_code != 201
    # Kod kuydirilgan -> endi TO'G'RI kod ham ishlamaydi
    rr = await api.post("/api/auth/verify-code", json={"nickname": nick, "code": code})
    assert rr.status_code != 201, "kuydirilgan kod hali qabul qilinyapti!"


async def test_ip_ban_anonymous_only(api):
    """Anonim hujum -> IP ban, lekin FAQAT anonim trafikni to'sadi.

    Bir xil (banlangan) IP'dagi tizimga kirgan foydalanuvchi token bilan erkin o'tadi.
    """
    from app.core.abuse import reset_state

    reset_state()
    headers = await _auth_user(api)
    bad_ip = "203.0.113.200"
    bad = {"X-Forwarded-For": bad_ip}

    # Anonim hujum -> IP banlanadi
    assert (
        await api.get("/api/health", params={"x": "../../etc/passwd"}, headers=bad)
    ).status_code == 403
    # Anonim so'rov shu IP'dan -> bloklangan
    assert (await api.get("/api/health", headers=bad)).status_code == 403
    # AMMO tizimga kirgan foydalanuvchi (token) SHU banlangan IP'dan -> erkin (200)
    r = await api.get("/api/topics", headers={**headers, "X-Forwarded-For": bad_ip})
    assert r.status_code == 200, "kirgan foydalanuvchi IP-bandan ta'sirlanmasligi kerak"
    # Boshqa IP'dan anonim -> normal
    assert (
        await api.get("/api/health", headers={"X-Forwarded-For": "203.0.113.201"})
    ).status_code == 200
    reset_state()


async def test_account_attack_does_not_block_others(api):
    """Tizimga kirgan akkaunt hujum qilsa -> FAQAT u bloklanadi; bir xil IP'dagi
    BOSHQA akkaunt umuman ta'sirlanmaydi (IP banlanmaydi)."""
    from app.core.abuse import reset_state

    reset_state()
    attacker = await _auth_user(api)
    victim = await _auth_user(api)
    shared_ip = "203.0.113.50"

    # Attacker hujum qiladi (shared_ip dan) -> o'zi bloklanadi
    r = await api.get(
        "/api/topics",
        params={"x": "../../etc/passwd"},
        headers={**attacker, "X-Forwarded-For": shared_ip},
    )
    assert r.status_code == 403
    # Attacker endi bloklangan (toza IP'dan ham)
    assert (
        await api.get("/api/auth/me", headers={**attacker, "X-Forwarded-For": "198.51.100.50"})
    ).status_code == 403
    # BOSHQA akkaunt SHU IP'dan -> erkin (IP banlanmagan)
    assert (
        await api.get("/api/auth/me", headers={**victim, "X-Forwarded-For": shared_ip})
    ).status_code == 200
    assert (
        await api.get("/api/topics", headers={**victim, "X-Forwarded-For": shared_ip})
    ).status_code == 200
    reset_state()


async def test_register_login_me(api):
    headers = await _auth_user(api)
    r = await api.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["role"] == "user"


async def test_protected_requires_auth(api):
    r = await api.get("/api/auth/me")
    assert r.status_code == 401


async def test_admin_dashboard(api):
    headers = await _auth_admin(api)
    r = await api.get("/api/admin/dashboard/summary", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["totalQuestions"] >= 24
    assert data["totalUsers"] >= 1
    r = await api.get("/api/admin/dashboard/timeseries?range=7d", headers=headers)
    assert r.status_code == 200
    assert len(r.json()["points"]) == 7


async def test_admin_requires_admin_role(api):
    headers = await _auth_user(api)  # ordinary user
    r = await api.get("/api/admin/dashboard/summary", headers=headers)
    assert r.status_code == 403


async def test_question_create_check_delete(api):
    headers = await _auth_admin(api)
    unique = "Sinov savol " + uuid.uuid4().hex
    payload = {
        "topicId": 1,
        "text": {"uz": unique, "kaa": unique + " kaa", "ru": unique + " ru"},
        "explanation": {"uz": "izoh", "kaa": "izoh", "ru": "izoh"},
        "options": [
            {"text": {"uz": "To'g'ri", "kaa": "Durıs", "ru": "Верно"}, "isCorrect": True},
            {"text": {"uz": "Xato", "kaa": "Qáte", "ru": "Неверно"}, "isCorrect": False},
        ],
    }
    r = await api.post("/api/admin/questions", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    q = r.json()
    qid = q["id"]
    assert q["text"]["ru"].endswith("ru")
    assert len(q["options"]) == 2

    # now it should be reported as existing
    r = await api.post("/api/admin/questions/check", json={"text": unique}, headers=headers)
    assert r.status_code == 200
    assert r.json()["exists"] is True

    # delete
    r = await api.delete(f"/api/admin/questions/{qid}", headers=headers)
    assert r.status_code == 204


async def test_real_exam_full_flow(api):
    headers = await _auth_user(api)
    # Real imtihon endi pulli — avval kirish sotib olamiz (darhol ochiladi).
    r = await api.post("/api/real-exam/purchase", json={"method": "demo"}, headers=headers)
    assert r.status_code == 201, r.text
    r = await api.post("/api/real-exam/start", headers=headers)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["durationSec"] == 1500
    assert data["passMaxMistakes"] == 2
    assert len(data["questions"]) == 20

    first = data["questions"][0]
    # every question carries all three languages and no correct flag
    assert set(first["text"].keys()) == {"kaa", "uz", "ru"}
    assert "isCorrect" not in first["options"][0]

    sid = data["sessionId"]
    r = await api.post(
        f"/api/real-exam/{sid}/answer",
        json={"questionId": first["questionId"], "optionId": first["options"][0]["optionId"]},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    r = await api.post(f"/api/real-exam/{sid}/finish", headers=headers)
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["total"] == 20
    assert "passed" in result
    assert len(result["results"]) == 20


async def test_rate_limit_login(api):
    """/auth/login limiti 10/min — 11-urinishda 429 (brute-force himoyasi).

    Bu endpoint boshqa testlarda ishlatilmaydi, shuning uchun limiter izolyatsiyasi
    buzilmaydi (login uchun alohida hisoblagich).
    """
    statuses = []
    for _ in range(11):
        r = await api.post(
            "/api/auth/login",
            json={"nickname": "NoSuch1User", "password": "Wrong1234"},
        )
        statuses.append(r.status_code)
    # Birinchi 10 tasi 401 (noto'g'ri parol), 11-chisi limit tufayli 429
    assert statuses.count(401) == 10, statuses
    assert statuses[-1] == 429, statuses
