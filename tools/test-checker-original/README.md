# Test savollari bazasi

Avto-test savollarini rasmlari bilan kiritadigan, takrorini tekshiradigan va
JSON faylga saqlaydigan dastur. Hamma ish **brauzerda** bajariladi, orqada
kichik Python server JSON va rasmlarni shu papkaga yozib boradi.

## Ishga tushirish

1. **`start.bat`** faylini ikki marta bosing.
2. Brauzer o'zi ochiladi (`http://127.0.0.1:8000`). Ochilmasa, shu manzilni
   brauzerga qo'lda kiriting.
3. Tugatgach, qora oynani yoping yoki unda **Ctrl+C** bosing — dastur to'xtaydi.

> Python o'rnatilgan bo'lishi kerak (sizda Python 3.12 bor). Agar `start.bat`
> ishlamasa, shu papkada terminal ochib `py server.py` deb yozing.

## Onlayn — do'stlar bilan birga (tunnel)

Do'stlaringiz ham savol qo'shishi uchun dasturni vaqtincha internetga ochish mumkin.
Bu **sizning kompyuteringizdagi** serverni ochiq havola qiladi (Cloudflare tunnel).

**Bir martalik tayyorgarlik — `cloudflared` o'rnatish:**
- Buyruq: `winget install --id Cloudflare.cloudflared`
- yoki [bu yerdan](https://github.com/cloudflare/cloudflared/releases/latest)
  `cloudflared-windows-amd64.exe` ni yuklab, nomini `cloudflared.exe` qilib shu
  papkaga qo'ying.

**Ishga tushirish:**
1. **`online.bat`** ni ikki marta bosing (oddiy `start.bat` o'rniga).
2. Ikkita oyna ochiladi. Biroz kutsangiz `https://....trycloudflare.com`
   havolasi chiqadi.
3. O'sha havolani do'stlaringizga yuboring — ular brauzerda ochib savol qo'shadi.
4. **Ikkala oyna ham ochiq tursin**, kompyuteringiz yoqilgan bo'lsin.

> ⚠️ **Diqqat:**
> - Havola **parolsiz** — kimda havola bo'lsa, savol qo'sha/o'chira oladi. Faqat
>   ishonchli do'stlaringizga yuboring.
> - Havola har safar `online.bat` qayta ishga tushganda **o'zgaradi**.
> - Kompyuteringiz o'chsa yoki oynalar yopilsa — havola ishlamaydi (doimiy onlayn
>   emas).
> - Tez-tez **📦 Zaxira (ZIP)** tugmasi bilan nusxa olib turing.

## Qanday ishlaydi

1. **Savol matnini** yozasiz.
2. Dastur darhol bazani tekshiradi:
   - 🟥 *Bunday savol bazada bor* — qo'shishga ruxsat berilmaydi, pastdagi
     joylar **ochilmaydi**.
   - 🟩 *Yangi savol* — variant va rasm joylari **ochiladi**.
3. **Variantlarni** yozib, ✔️ orqali to'g'ri javob(lar)ni belgilaysiz.
   Savolga ham, har bir variantga ham **rasm** qo'sha olasiz.
4. **💾 Saqlash** — savol bazaga yoziladi.
5. O'ng tarafdagi ro'yxatdan istalgan savolni **✏️ Tahrirlash** yoki
   **🗑️ O'chirish** mumkin.

Takror tekshiruvi matnni soddalashtirib solishtiradi: katta-kichik harf,
ortiqcha probel, tinish belgilari **va lotin/kirill yozuvi** hisobga olinmaydi.
Masalan `2 + 2 = 4 ?` va `2+2=4`, shuningdek `Svetofor` va `Светофор` bir xil
savol deb topiladi — ya'ni bir savolni ikkala yozuvda ham takror kirita olmaysiz.

Savolni **lotinda** yozasiz, **kirillchasi avtomatik** chiqadi. **🌐 Rus tarjima**
tugmasi savol va variantlarni rus tiliga o'giradi (internet kerak; tahrirlasa bo'ladi).
Har bir savol bazada **uch tilda** saqlanadi: lotin + kirill + rus.

## Zaxira va ko'chirish

Yuqori o'ng burchakda 2 ta tugma bor:

- **⬇️ JSON** — faqat savollarni (matn + variantlar) yengil JSON fayl qilib yuklaydi.
- **📦 Zaxira (ZIP)** — savollar **va barcha rasmlarni** bitta ZIP faylga jamlaydi.
  Boshqa kompyuterga ko'chirish yoki to'liq zaxira uchun shuni ishlating.

⚠️ `images/` papka — ma'lumotingizning bir qismi (rasmlar shu yerda turadi, `questions.json`
 da faqat ularning yo'li bor). Bu papkani yoki ichidagi fayllarni **o'chirmang**, aks holda
o'sha savollar rasmsiz qoladi. Zaxira/ko'chirish uchun **📦 ZIP** tugmasidan foydalaning.

## Fayllar

| Fayl / papka        | Vazifasi                                              |
|---------------------|-------------------------------------------------------|
| `start.bat`         | Dasturni ishga tushiradi                              |
| `server.py`         | Lokal server (fayllarni saqlaydi)                     |
| `index.html`        | Sahifa ko'rinishi                                     |
| `style.css`         | Dizayn                                                |
| `app.js`            | Brauzer mantig'i                                      |
| **`questions.json`**| **Savollar bazasi** (avtomatik yaratiladi)            |
| **`images/`**       | **Rasmlar** papkasi (avtomatik yaratiladi)            |

## `questions.json` ko'rinishi (oldingi test fayli formati)

```json
{
  "manba": "avtotestu.uz + qo'lda kiritilgan",
  "jami_savollar": 576,
  "rasmli_savollar": 335,
  "savollar": [
    {
      "id": "q_1718600000000_ab12cd",
      "raqam": 1,
      "rasm": "images/u57uz.webp",
      "uz_lotin": {
        "savol": "O'zbekiston poytaxti qaysi shahar?",
        "variantlar": [
          { "matn": "Toshkent", "togri": true },
          { "matn": "Samarqand", "togri": false }
        ]
      },
      "uz_kirill": {
        "savol": "Ўзбекистон пойтахти қайси шаҳар?",
        "variantlar": [
          { "matn": "Тошкент", "togri": true },
          { "matn": "Самарқанд", "togri": false }
        ]
      },
      "rus": {
        "savol": "Какой город является столицей Узбекистана?",
        "variantlar": [
          { "matn": "Ташкент", "togri": true },
          { "matn": "Самарканд", "togri": false }
        ]
      },
      "createdAt": "2026-06-17T10:00:00+00:00",
      "updatedAt": "2026-06-17T10:00:00+00:00"
    }
  ]
}
```

> Eslatma: papka OneDrive ichida. Dastur bazani xotirada saqlab, faylni band
> bo'lganda qayta urinadi — shu sabab OneDrive sinxronlashi ma'lumotni buzmaydi.
