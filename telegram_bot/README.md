# TayyorPrava — Telegram tasdiqlash boti

Ro'yxatdan o'tish va parolni tiklashda 5 xonali tasdiq kodini beradi.
Kod berishdan oldin foydalanuvchining **@TayyorPrava** kanaliga obunasini tekshiradi.

## Talablar
- Python 3.10+
- Bot **@TayyorPrava** kanaliga **admin** qilib qo'shilgan bo'lishi shart
  (aks holda Telegram obunani tekshirishga ruxsat bermaydi).

## O'rnatish

```bash
cd telegram_bot
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

## Sozlash
`.env` faylidagi qiymatlar (token, kanal, backend manzili, maxfiy kalit).
`BOT_SHARED_SECRET` backenddagi (`app/core/config.py` → `BOT_SHARED_SECRET`) bilan
**bir xil** bo'lishi shart.

## Ishga tushirish

```bash
python bot.py
```

Backend (`http://127.0.0.1:8000`) ishlab turishi kerak.

## Oqim
1. Foydalanuvchi saytda ro'yxatdan o'tadi (ism, familiya, nik, parol).
2. Botga nikini yuboradi → bot kanal obunasini tekshiradi.
3. Obuna bo'lsa → backenddan kod oladi va yuboradi (5 daqiqa amal qiladi).
4. Foydalanuvchi kodni saytga kiritadi → profil ochiladi.
