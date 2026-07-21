# Prava Pro — Avtotest platformasi (Fullstack)

Haydovchilik guvohnomasi uchun onlayn avtotest platformasi (rulionline.uz uslubida).
Loyiha uch qismdan iborat:

- **A. Foydalanuvchi ilovasi** (React) — mashq, imtihon, **real imtihon (3 tilli)**, profil, to'lov, referal
- **B. Admin panel** (React) — dashboard, savollar (CRUD), tariflar, to'lovlar, foydalanuvchilar, sozlamalar
- **C. Backend** (Python / FastAPI) — REST API + ma'lumotlar bazasi (SQLite/PostgreSQL)

> UI/UX: glassmorphism, navy fon (`#0B1120`), ko'k accent (`#2563EB`), Framer Motion animatsiyalari,
> Dark/Light/System rejim, 3 interfeys tili (O'zbek lotin · Кирил · Рус).

---

## Texnologiyalar

| Qatlam | Stek |
|---|---|
| Frontend | Vite, React 18, TypeScript, Tailwind CSS, React Router v6, TanStack Query, axios, Zustand, Framer Motion, react-i18next, recharts, lucide-react |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, python-jose (JWT), bcrypt, Pillow, aiofiles, Uvicorn |
| Ma'lumotlar bazasi | SQLite (dev) / PostgreSQL (prod) |

---

## Tuzilma

```
prava-pro/
├─ backend/          # FastAPI REST API
│  ├─ app/
│  │  ├─ main.py            # ilova, CORS, StaticFiles, routerlar
│  │  ├─ core/              # config, security (JWT, bcrypt)
│  │  ├─ db/                # async engine, session, Base
│  │  ├─ models/            # SQLAlchemy modellar (ko'p tilli savollar)
│  │  ├─ schemas/           # Pydantic sxemalar (camelCase)
│  │  ├─ crud/              # repository qatlami
│  │  ├─ services/          # biznes-mantiq (exam, dashboard, serializers)
│  │  ├─ api/routes/        # endpointlar
│  │  ├─ deps.py            # get_db, get_current_user, get_current_admin
│  │  ├─ seed.py            # boshlang'ich ma'lumot
│  │  └─ seed_data.py       # 42 mavzu + 24 ta 3 tilli savol
│  ├─ tests/               # pytest (httpx ASGI)
│  └─ requirements.txt
└─ frontend/         # React + Vite
   └─ src/
      ├─ app routes (App.tsx), layouts/, pages/ (user + admin)
      ├─ components/ (ui, shared, admin)
      ├─ lib/ (api, queries, i18n, types, lang, utils)
      └─ store/ (ui, auth, realExam — Zustand)
```

---

## Ishga tushirish

### 1) Backend (port 8000)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
python -m app.seed                 # bazani yaratadi + boshlang'ich ma'lumot
python -m uvicorn app.main:app --reload   # http://localhost:8000  (hujjat: /docs)
```

- Swagger hujjatlari: **http://localhost:8000/docs**
- `.env` (allaqachon mavjud): `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, ...
- PostgreSQL uchun `.env` da: `DATABASE_URL=postgresql+asyncpg://user:pass@localhost/pravapro`

### 2) Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

- `frontend/.env`: `VITE_API_URL=http://localhost:8000/api`

---

## Kirish ma'lumotlari (demo)

| Rol | Manzil | Login | Parol |
|---|---|---|---|
| Foydalanuvchi | `/login` | `+99891000000` | `user123` |
| Admin | `/admin/login` | `admin` | `admin` |

> Yangi foydalanuvchi `/register` orqali ham ro'yxatdan o'tishi mumkin.

---

## Asosiy imkoniyatlar

### Foydalanuvchi ilovasi
- Bosh sahifa: tezkor amallar, statistika kartalari (count-up animatsiya)
- Mavzu bo'yicha mashq (42 mavzu), savol rasmi, izoh, sevimli/xato belgilash, F1–F4 tugmalari
- **⭐ Real imtihon** (`/real-exam`):
  - **20 savol**, **25 daqiqa** teskari taymer (oxirgi daqiqada qizil "pulse")
  - **Javob variantlari pastda**
  - Javob bosilganda **«Ҳа / Йўқ» tasdiqlash modali** → Ҳа qulflaydi va keyingi savolga o'tadi
  - Savolga qaytilganda **variantlar qayta aralashadi (shuffle)**
  - **⭐ 3 tilli savol**: Qoraqalpoqcha · O'zbekcha · Русский — til almashtirilganda savol va variantlar darhol shu tilda (silliq fade), tanlangan javob/shuffle saqlanadi
  - Yakunda natija: o'tdi/o'tmadi, to'g'ri/xato soni, qayta topshirish
- Profil, To'lov (dinamik tariflar + usullar), Referal (havola nusxalash)

### Admin panel
- **Dashboard**: StatCard count-up + recharts grafiklar (ro'yxat/to'lov/daromad, pass-rate, mavzular taqsimoti), 7/30/90 kun filtri, avto-yangilanish
- **Savollar**: ro'yxat (filtr/qidiruv/sahifalash); **ko'p bosqichli qo'shish** (avval matn → bazadan tekshirish → mavjud bo'lsa ogohlantirish, bo'lmasa 3 til tablari + variant + rasm); **modal orqali o'chirish**
- **Tariflar**: CRUD + faollik toggle; **to'lov usullari** yoqish/o'chirish (foydalanuvchi `/payment` da darhol aks etadi)
- **To'lovlar**, **Foydalanuvchilar** (bloklash), **Mavzular** (CRUD), **Referal**, **Sozlamalar**

---

## Savol bazasini himoyalash (anti-scraping)

Tizimga kirgan foydalanuvchi savollar bazasini ketma-ket so'rab ko'chirib olmasligi uchun
ko'p qatlamli himoya (barchasi `.env` orqali sozlanadi):

| # | Chora | Tafsilot |
|---|---|---|
| 1 | **Rate limit** | Savol endpointlari foydalanuvchi bo'yicha `RATE_LIMIT_QUESTIONS` (20/min). Oshganda **429 + Retry-After**. Stor: `REDIS_URL` bo'lsa Redis, aks holda in-memory sliding-window. |
| 2 | **Anomaliya** | `SCRAPE_WINDOW_SECONDS` (60s) ichida `SCRAPE_DISTINCT_TOPICS` (10) dan ko'p **turli** topic/ticket so'ralsa → akkaunt eskalatsion bloki (5→15 daq→admin). Bitta mavzuni sahifalash anomaliya emas. |
| 3 | **Pagination** | `/topics/{id}/questions`, `/tickets/{n}/questions`: `limit` (default 10, **max 20**) + `offset`. To'liq mavzu birdaniga qaytmaydi; frontend partiyalab yuklaydi (UI o'zgarmagan). |
| 4 | **Tarif qulfi** | Bepul (obunasiz) foydalanuvchi faqat namuna (`DEMO_MAX_TOPIC_ID`/`DEMO_MAX_TICKET` = 1‑2). Tashqarisi → **403** (`X-Content-Gate: tariff`). Admin/aktiv obuna → to'liq. |
| 5 | **Javob kaliti** | `correctOptionId`/`isCorrect` savol endpointlarida **yo'q** — tekshiruv faqat server `POST /api/check-answer`. |
| 6 | **API hujjatlari** | Production'da (`DEBUG=False`) `/docs`, `/redoc`, `/openapi.json` **yopiq**. |
| 7 | **Variant aralashtirish** | Har so'rovda options tartibi tasodifiy (`SHUFFLE_OPTIONS`) — javob pozitsiyasi yodlanmaydi (ID'lar uuid). |
| 8 | **Ochiq endpoint limiti** | Tokensiz endpointlar (`/landing`, `/tariffs` — mehmon bosh sahifasi) IP bo'yicha `RATE_LIMIT_PUBLIC` (30/min). Qolgan barcha ma'lumot API'lari **token talab qiladi** (tokensiz → 401). |
| 9 | **So'rov hajmi (DoS)** | `MAX_REQUEST_MB` (8MB) dan katta tana **413** bilan tanani o'qimasdan rad etiladi. Yuklangan fayllar (`/static`) endi abuse guard ostida — hujum imzosi + xavfsizlik sarlavhalari (`nosniff`). |
| 10 | **Brauzer hujumi → akkaunt bloki** | Kirgan akkaunt orqali brauzerdan hujum (SQLi/XSS/injection) — **URL'da ham, so'rov tanasida ham** (`POST/PUT/PATCH`, JSON/forma) — aniqlansa: akkaunt **darhol eskalatsion bloklanadi** (1‑urinish→5 daq, 2→15 daq, 3→faqat admin ochadi), frontend **sessiyani tugatib, sahifani yangilab** login'ga chiqaradi. Auth (parol/nik), bot, admin yo'llari tanani skanidan ozod (noto'g'ri musbatsiz). |

> **Sabab:** rate-limit + anomaliya + pagination + tarif qulfi birgalikda bazani tez ko'chirishni
> imkonsiz qiladi (limit/blokdan tashqari, bepul user faqat namunani oladi), javob kaliti esa
> hech qachon mijozga chiqmaydi. Sozlamalar — `backend/.env.example`.

---

## Test

```bash
cd backend
.venv\Scripts\activate
python -m pytest -q          # 9 ta integratsion test (httpx ASGI)
```

Frontend build/typecheck:
```bash
cd frontend
npm run build                # tsc --noEmit + vite build
```

---

## API (asosiy endpointlar)

`🔒` = foydalanuvchi JWT, `🛡️` = admin JWT. Barchasi `/api` prefiksida.

- **Auth**: `POST /auth/register`, `POST /auth/login`, `GET 🔒 /auth/me`, `POST 🛡️ /admin/auth/login`
- **Test bazasi**: `GET /topics`, `GET 🔒 /topics/{id}/questions`, `POST 🛡️ /admin/questions/check`, `POST/PUT/DELETE 🛡️ /admin/questions`, `POST 🛡️ /admin/questions/{id}/image`
- **Real imtihon**: `POST 🔒 /real-exam/start` (20 savol, 3 til), `POST 🔒 /real-exam/{id}/answer`, `POST 🔒 /real-exam/{id}/finish`
- **Tariflar/to'lov**: `GET /tariffs`, `GET /payment-methods`, `POST 🔒 /payments`, admin CRUD
- **Dashboard**: `GET 🛡️ /admin/dashboard/summary | timeseries | topics-distribution | exam-pass-rate`

To'liq ro'yxat: **http://localhost:8000/docs**
