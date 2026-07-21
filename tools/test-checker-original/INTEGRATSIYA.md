# Test-checker — asl kod (ma'lumotnoma)

Bu papkadagi fayllar `rasmlar.zip` dan kelgan mustaqil "Test savollari bazasi"
dasturining ASL kodi (faqat ma'lumotnoma uchun). Dasturning o'z `questions.json`
va `images/` bazasi **ishlatilmaydi** — texnologiyasi TayyorPrava saytiga
to'g'ridan-to'g'ri (natively) integratsiya qilingan, jonli sayt test bazasiga ulangan.

## Qayerga integratsiya qilindi

| Asl tool qismi | Saytdagi joyi |
|---|---|
| Takror tekshiruvi (`dup_key`, lotin/kirill farqsiz) | `backend/app/crud/questions.py` → `dup_key`, `find_duplicate_question` |
| `/api/questions/check` | `POST /api/admin/questions/check` (dublikat matnini ham qaytaradi) |
| Rus tarjima (`translate_uz_to_ru`) | `backend/app/services/translate.py` + `POST /api/admin/questions/translate` |
| Lotin→kirill avto (`translit_lat_to_cyr`) | `frontend/src/lib/translit.ts` → `latToCyr` |
| Savol formasi + ro'yxat (index.html/app.js) | `frontend/src/pages/admin/AdminTestChecker.tsx` (admin → "Test tekshirish") |
| Saqlash (questions.json) | Jonli baza: `POST /api/admin/questions` (uz/kaa/ru + variant + rasm) |

## Natija

Admin panel → **Test tekshirish** bo'limi: savolni lotinda yozasiz, kirilli
avtomatik chiqadi, takror lotin/kirill farqsiz tekshiriladi, rus tarjima tugma
bilan. Tekshiruvdan o'tgan har bir yangi savol **jonli test bazaga** qo'shiladi va
darhol mashq/real imtihonda ishlatiladi.
