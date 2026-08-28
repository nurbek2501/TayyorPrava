"""Application configuration loaded from environment / .env (pydantic-settings)."""
from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Zaif/namuna SECRET_KEY qiymatlari — production'da bulardan biri qolsa JWT soxtalashtirilishi mumkin.
_WEAK_SECRETS = {
    "prava-pro-super-secret-change-in-production",
    "CHANGE_ME_TO_A_LONG_RANDOM_SECRET",
    "",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    PROJECT_NAME: str = "TayyorPrava"
    API_PREFIX: str = "/api"

    # Rivojlanish rejimi (batafsil log). Production'da .env da False qoldiring.
    DEBUG: bool = False

    # Database — SQLite for local/dev, PostgreSQL (asyncpg) for production.
    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"

    # Security / JWT
    SECRET_KEY: str = "prava-pro-super-secret-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # File uploads
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 5

    # Telegram bot integratsiyasi
    BOT_USERNAME: str = "TayyorPrava_bot"
    TELEGRAM_CHANNEL: str = "@TayyorPrava"
    CHANNEL_URL: str = "https://t.me/TayyorPrava"
    # Bot bilan backend o'rtasidagi maxfiy kalit (bot bu kalit bilan kod so'raydi).
    # Haqiqiy qiymat faqat .env da; bo'sh bo'lsa bot endpointi butunlay qulflanadi.
    BOT_SHARED_SECRET: str = ""
    # Webhook rejimi: BOT_TOKEN berilsa bot backend ichida ishlaydi (alohida worker
    # shart emas — services/telegram_bot.py). Bo'sh bo'lsa webhook o'rnatilmaydi.
    BOT_TOKEN: str = ""
    # Webhook bazaviy URL: bo'sh bo'lsa Render'ning RENDER_EXTERNAL_URL'i olinadi
    # (lokal test uchun masalan ngrok manzilini berish mumkin).
    WEBHOOK_BASE_URL: str = ""
    # Tasdiq kodi necha daqiqa amal qiladi
    CODE_TTL_MINUTES: int = 5
    # Tasdiq kodini necha marta xato kiritish mumkin — oshsa kod kuydiriladi (brute-force himoyasi).
    MAX_CODE_ATTEMPTS: int = 5

    # Rate limiting (brute-force himoyasi). Noto'g'ri proxy sozlamasida o'chirish mumkin.
    RATE_LIMIT_ENABLED: bool = True
    # Rate-limit stor'i: Redis bo'lsa (ko'p worker uchun) "redis://host:6379/0",
    # bo'sh bo'lsa jarayon-ichi (in-memory) sliding-window. `redis` paketi kerak bo'ladi.
    REDIS_URL: str = ""
    # Savol (mashq) endpointlari uchun limit. Bitta akkauntni bir necha odam BIRGA
    # ishlatishi mumkin (SCRAPE_GUARD_ENABLED=False), shuning uchun chegara faqat
    # serverni haddan tashqari yukdan saqlash uchun — halol foydalanuvchilar yetmaydi.
    RATE_LIMIT_QUESTIONS: str = "300/minute"
    # Javob tekshirish / imtihon boshlash limiti (birga ishlatishga xalaqit bermasin).
    RATE_LIMIT_ANSWERS: str = "300/minute"
    # Savol/javob endpointlariga IP bo'yicha QO'SHIMCHA global limit (user-limit ustiga).
    # Ko'p akkaunt (tekin ro'yxat) bilan bitta IP'dan parallel scrape'ni sekinlashtiradi.
    # Kengroq: bir NAT (maktab/oila) ortidagi bir nechta halol o'quvchi bunga yetmaydi.
    RATE_LIMIT_QUESTIONS_IP: str = "300/minute"
    # Ochiq (tokensiz) endpointlar — mehmon bosh sahifasi: /landing va /tariffs.
    # Bular bazani oshkor qilmaydi, lekin hamm—ga ochiq, shuning uchun IP bo'yicha cheklanadi.
    RATE_LIMIT_PUBLIC: str = "30/minute"
    # So'rov tanasi (body) uchun global maksimal hajm — juda katta yuk (DoS) erta rad etiladi.
    # Rasm yuklashdan (MAX_UPLOAD_MB) yuqori qo'yiladi (multipart qo'shimcha yuki uchun zaxira).
    MAX_REQUEST_MB: int = 8
    # Savol endpointlari sahifalash: bir so'rovda nechta savol (to'liq mavzu birdaniga emas).
    QUESTIONS_PAGE_DEFAULT: int = 10
    QUESTIONS_PAGE_MAX: int = 20

    # Tarifga asoslangan kirish: bepul (obunasiz) foydalanuvchilar faqat namunani ko'radi.
    DEMO_MAX_TOPIC_ID: int = 2   # bepul: topic 1..2
    DEMO_MAX_TICKET: int = 2     # bepul: bilet 1..2

    # Mashq variantlarini har so'rovda aralashtirish (javob pozitsiyasi yodlanmasin).
    SHUFFLE_OPTIONS: bool = True

    # Bonusga shaxsiy promokod sotib olish narxi (so'm). Foydalanuvchi shuncha
    # bonus yig'sa, uni bir martalik real-imtihon kodiga almashtira oladi.
    PROMO_BONUS_PRICE: int = 200_000

    # Suiiste'mol/hujum aniqlash → avtomatik akkaunt bloki (eskalatsiya bilan).
    # Bu HUJUM himoyasi (SQLi/XSS/skaner imzolari) — doim yoqilgan qolsin.
    ABUSE_GUARD_ENABLED: bool = True
    # Scraping (baza ko'chirish) detektorlari AKKAUNT bo'yicha ishlaydi va bitta
    # akkauntni bir necha odam BIRGA ishlatganini "bot" deb hisoblab bloklab qo'yardi.
    # Akkauntni bo'lishishga ruxsat berilgani uchun o'chirilgan (False).
    #   True qilinsa: turli mavzu / umumiy hajm / javob-kaliti anomaliyalari qaytadan
    #   akkauntni avtomatik bloklaydi va savol bazasi ko'chirilishidan himoyalanadi.
    # ⚠️ False bo'lganda savol bazasini ommaviy yuklab olishdan himoya yo'q.
    SCRAPE_GUARD_ENABLED: bool = False
    ABUSE_WINDOW_SECONDS: int = 300   # xulq hisobi oynasi (5 daqiqa)
    ABUSE_USER_THRESHOLD: int = 15    # shu oynada shubhali hodisa → akkaunt bloki
    ABUSE_IP_THRESHOLD: int = 25      # shu oynada → IP vaqtincha ban
    ABUSE_BAN_SECONDS: int = 900      # IP ban muddati (15 daqiqa)
    # Akkaunt blokining eskalatsiyasi: 1-marta -> 5 daq, 2-marta -> 15 daq,
    # 3-marta va undan keyin -> faqat admin ochadi.
    ABUSE_BLOCK_1_SECONDS: int = 300   # 1-blok: 5 daqiqa
    ABUSE_BLOCK_2_SECONDS: int = 900   # 2-blok: 15 daqiqa
    # Scraping anomaliyasi: SCRAPE_WINDOW_SECONDS ichida shuncha TURLI topic/ticket
    # so'ralsa -> akkaunt bloklanadi (eskalatsiya bilan).
    SCRAPE_DISTINCT_TOPICS: int = 10
    SCRAPE_WINDOW_SECONDS: int = 60
    # Umumiy hajm anomaliyasi: kirgan foydalanuvchiga SERVE_SCRAPE_WINDOW ichida
    # berilgan JAMI savollar SERVE_SCRAPE_MAX dan oshsa -> avto-blok. Barcha savol
    # endpointlarini (topic/ticket/random/id/smart-start) qamrab oladi — topic/ticket
    # detektori yetmaydigan yo'llarni (random, smart-test) ham yopadi. Chegara halol
    # eng og'ir mashqdan ancha yuqori (5 daqiqada 700 savol ≈ mashina, odam emas).
    SERVE_SCRAPE_WINDOW: int = 300
    SERVE_SCRAPE_MAX: int = 700
    # Javob-kaliti anomaliyasi: ANSWER_REVEAL_WINDOW ichida shuncha TURLI savol uchun
    # to'g'ri javob so'ralsa (check-answer/smart-answer) -> avto-blok. Javob kaliti eng
    # qimmatli aktiv; halol o'quvchi 5 daqiqada 180 turli savolga javob bermaydi.
    ANSWER_REVEAL_WINDOW: int = 300
    ANSWER_REVEAL_MAX: int = 180
    # Reverse-proxy (nginx) ortida X-Forwarded-For'ga ishonish. To'g'ridan-to'g'ri
    # ochiq (proxysiz) bo'lsa False qiling — aks holda hujumchi XFF'ni soxtalashtirib
    # IP-ban/rate-limit'ni chetlab o'tadi. Prod'da nginx bo'lsa True (default).
    TRUST_FORWARDED_FOR: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @model_validator(mode="after")
    def _normalize_database_url(self) -> "Settings":
        # Render (va ko'p hosting) Postgres URL'ini `postgres://` yoki `postgresql://`
        # ko'rinishida beradi — bu sinxron drayverni (psycopg2) tanlaydi va async engine'da
        # ishlamaydi. Async `asyncpg` drayveriga majburiy o'tkazamiz.
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        # asyncpg SSL parametrini `sslmode` orqali tushunmaydi (bu libpq/psycopg sozlamasi) —
        # Render ba'zan qo'shadi; olib tashlaymiz (asyncpg TLS'ni o'zi hal qiladi).
        if "+asyncpg://" in url and "sslmode=" in url:
            import re
            url = re.sub(r"[?&]sslmode=[^&]*", "", url)
        self.DATABASE_URL = url
        return self

    @model_validator(mode="after")
    def _enforce_prod_secret(self) -> "Settings":
        # Production'da (DEBUG=False) zaif/namuna yoki QISQA (past-entropiya) SECRET_KEY
        # bilan ishga tushirmaymiz — aks holda tokenlar soxtalashtirilishi mumkin.
        # Dev'da (DEBUG=True) ogohlantirmaydi.
        if not self.DEBUG and (
            self.SECRET_KEY in _WEAK_SECRETS or len(self.SECRET_KEY) < 32
        ):
            raise ValueError(
                "SECRET_KEY production uchun yetarlicha kuchli emas. .env da kamida 32 "
                "belgili uzun, tasodifiy qiymat bering (masalan: openssl rand -hex 48)."
            )
        return self


settings = Settings()
