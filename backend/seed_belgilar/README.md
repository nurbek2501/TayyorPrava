# Yo'l belgilari — 3 tilli (uz · kaa · ru)

`yol-belgilari.zip` asosida barcha yo'l belgilari uch tilga tayyorlandi va saytga
joylashga tayyor (rasmlar servable).

- **uz** — o'zbek lotin (manba nomlar)
- **kaa** — kirill (lotindan transliteratsiya: `to_cyrillic`)
- **ru** — rus tili (rasmiy ПДД belgi nomlari)

## Tarkibi

| Fayl / papka | Izoh |
|---|---|
| `yol-belgilari-3til.json` | 268 belgi, 7 kategoriya — har biri `name{uz,kaa,ru}` + `code` + `imageUrl` |
| `rasmlar/` | 268 ta asl rasm (gif/png/jpg) — arxiv nusxa |
| `yol-belgilari.json` | asl (1 tilli) fayl |

Rasmlar `backend/uploads/belgilar/` ga ko'chirilgan → `/static/belgilar/<fayl>` orqali
xizmat qilinadi (FastAPI `/static` mount). JSON shu yo'llarni ko'rsatadi.

## Statistika

- Belgilar: **268** — uz/kaa/ru 100%
- Kategoriyalar: 7 (Ogohlantiruvchi, Imtiyozli, Ta'qiqlovchi, Buyuruvchi, Axborot-ishora, Servis, Qo'shimcha)
- Rasmlar: 268 (servable, 0 yetishmaydi)

## JSON ko'rinishi

```json
{
  "title": {"uz": "...", "kaa": "...", "ru": "..."},
  "languages": ["uz", "kaa", "ru"],
  "totalSigns": 268,
  "imagesBase": "/static/belgilar/",
  "categories": [
    {
      "code": "1",
      "category": {"uz": "Ogohlantiruvchi belgilar", "kaa": "Огоҳлантирувчи белгилар", "ru": "Предупреждающие знаки"},
      "count": 46,
      "signs": [
        {"code": "1.1",
         "name": {"uz": "Shlagbaumli temir yo'l kesishmasi", "kaa": "Шлагбаумли темир йўл кесишмаси", "ru": "Железнодорожный переезд со шлагбаумом"},
         "imageUrl": "/static/belgilar/1.1.gif"}
      ]
    }
  ]
}
```

## Saytga ulash (keyingi qadam)

Ma'lumot + rasmlar tayyor. Saytda ko'rsatish uchun frontend "Yo'l belgilari" bo'limi
(kategoriyalar + rasm + 3 tilli nom, interfeys tiliga qarab) qo'shilishi mumkin —
backend bu JSON ni o'qib `GET /api/road-signs` orqali bersa bo'ladi (hozircha tayyor emas).
