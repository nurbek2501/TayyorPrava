# Prava Pro — Production'ga chiqarish (Deployment)

Bu qo'llanma loyihani **Docker** bilan ishlab chiqarishga (production) chiqarishni tushuntiradi:
backend (FastAPI) + telegram bot konteynerlarda, frontend statik build nginx orqali.

> Dev (lokal) rejim hamon eski tartibda ishlaydi (qarang: `README.md`). Bu fayllar
> faqat production uchun — ishlab turgan saytga ta'sir qilmaydi.

---

## 0) Talablar
- Linux server (Ubuntu 22.04+ tavsiya), domen (masalan `tayyorprava.uz`)
- Docker + Docker Compose plugin
- nginx + certbot (TLS uchun)

---

## 1) Maxfiy sozlamalar (.env)

`.env.example` lardan nusxa oling va **haqiqiy** qiymatlarni qo'ying:

```bash
cp backend/.env.example       backend/.env
cp telegram_bot/.env.example  telegram_bot/.env
cp frontend/.env.example      frontend/.env
```

`backend/.env` da:
- `SECRET_KEY` — kuchli: `python -c "import secrets; print(secrets.token_hex(48))"`
- `BOT_SHARED_SECRET` — kuchli: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `CORS_ORIGINS=https://tayyorprava.uz` — **prod domeningiz** (vergul bilan bir nechta)
- `DEBUG=False`, `RATE_LIMIT_ENABLED=True`

`telegram_bot/.env` da:
- `BOT_TOKEN` — @BotFather'dan (⚠️ avval eskisini `/revoke` qiling, agar ochiq ko'rilgan bo'lsa)
- `BOT_SHARED_SECRET` — backend'dagi bilan **aynan bir xil**

`frontend/.env` da:
- `VITE_API_URL=https://api.tayyorprava.uz/api` (yoki `https://tayyorprava.uz/api`)

---

## 2) Backend + bot (Docker Compose)

```bash
docker compose build
docker compose run --rm backend python -m app.seed   # bazani to'ldirish (BIR MARTA)
docker compose up -d
docker compose logs -f backend                        # loglar
```

- Backend: `http://SERVER:8000` (nginx ortida proxy qilinadi)
- Sog'liq tekshiruvi: `curl http://localhost:8000/api/health` → `{"status":"ok"}`
- Baza nomli volume'da (`backend_db`) — qayta build qilsangiz ham saqlanadi.
- Rasm kontenti host'dagi `backend/uploads/` dan ulanadi.

> 3 tilli bazani ishlatsangiz, seed o'rniga o'z import skriptlaringizni konteyner ichida
> ishga tushiring: `docker compose run --rm backend python apply_3lang.py` (h.k.).

---

## 3) Frontend (statik build)

```bash
cd frontend
npm ci
npm run build        # natija: frontend/dist/
```

`dist/` ni nginx tarqatadi (quyida).

---

## 4) nginx (reverse proxy + statik + TLS)

`/etc/nginx/sites-available/tayyorprava`:

```nginx
server {
    server_name tayyorprava.uz www.tayyorprava.uz;

    # Frontend (statik PWA)
    root /var/www/tayyorprava/dist;
    index index.html;

    # --- Xavfsizlik sarlavhalari (frontend HTML) ---
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    # CSP — XSS himoyasi (localStorage tokenini o'g'irlashni qiyinlashtiradi).
    # connect-src ga API domeningizni qo'shing; build buzilsa moslang.
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.tayyorprava.uz; frame-ancestors 'none'; base-uri 'self'" always;

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # rate-limit IP'si uchun MUHIM
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Yuklangan rasmlar (savol/belgi)
    location /static/ {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tayyorprava /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tayyorprava.uz -d www.tayyorprava.uz   # HTTPS
```

> `X-Forwarded-For` ni uzatish **shart** — aks holda rate-limit hammani bitta IP deb hisoblaydi.

---

## 5) Yangilash (deploy)

```bash
git pull
cd frontend && npm ci && npm run build && sudo cp -r dist/* /var/www/tayyorprava/dist/ && cd ..
docker compose build && docker compose up -d
```

---

## 6) Masshtablash (keyinchalik, 10k+ foydalanuvchi)

Hozir: bitta uvicorn worker + SQLite (WAL). Bu o'rta yuklama uchun yetarli.
Katta yuklamada:
- **PostgreSQL**: `backend/.env` da `DATABASE_URL=postgresql+asyncpg://user:pass@db/pravapro`,
  compose'ga `postgres` xizmati qo'shing. (Kod allaqachon asyncpg'ni qo'llaydi.)
- **Ko'p worker**: gunicorn + uvicorn worker. Lekin slowapi in-memory bo'lgani uchun
  rate-limit har workerda alohida bo'ladi → **Redis** storage ulang (`limits` kutubxonasi
  Redis'ni qo'llaydi) yoki bitta workerda qoldiring.
- Statik/rasm: CDN yoki nginx cache.

---

## 7) Eslatma — xavfsizlik
- `backend/.env`, `telegram_bot/.env` **hech qachon** git'ga tushmaydi (`.gitignore`).
- Bot tokeni bir marta ochiq ko'rilgan bo'lsa — @BotFather'da yangilang.
- `DEBUG=False` (prod) — kutilmagan xatolar mijozga trace chiqarmaydi (faqat logda);
  `/docs`, `/openapi.json` ham yopiladi.
- **Avto-himoya** (backend): hujum/suiiste'mol → akkaunt eskalatsion bloki
  (5 daq → 15 daq → admin); login bruteforce → IP ban; xavfsizlik sarlavhalari + CSP barcha javoblarga.
- **Tokenlar localStorage'da (Bearer)** — bu **mobil ilova** (Capacitor WebView + cross-origin API)
  uchun zarur; HttpOnly cookie mobil ilovani buzadi va CSRF qatlamini talab qiladi. XSS xavfi
  past (frontend `dangerouslySetInnerHTML`/`innerHTML` ishlatmaydi) va yuqoridagi **CSP**
  qo'shimcha himoya beradi. Agar kelajakda faqat veb (mobilsiz) bo'lsa — HttpOnly+SameSite
  cookie + CSRF tokenga o'tish mumkin.
