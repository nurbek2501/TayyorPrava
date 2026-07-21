# Prava Pro — 3 tilli test bazasi (uz · kaa · ru)

`prava-pro-1224` bazasi uch tilga tayyorlangan:

- **uz** — o'zbek lotin (manba)
- **kaa** — kirill (lotindan deterministik transliteratsiya: `o'→ў`, `g'→ғ`, `'→ъ`, `YHQ→ЙҲҚ`)
- **ru** — rus tili (qo'lda tarjima; YHQ/ПДД atamalari, huquqiy/tibbiy iboralar to'g'ri)

## Tarkibi

| Fayl | Izoh |
|---|---|
| `questions_3lang.json` | 1224 savol — har biri `text{uz,kaa,ru}`, `options[].text{uz,kaa,ru}`, `explanation{uz,kaa,ru}`, `topic_id`, `image_url` |
| `images/` | 709 ta `.webp` rasm |

## Statistika

- Savol: **1224** — uz/kaa/ru 100% to'la
- Variant: **4015** — uz/kaa/ru 100% to'la
- Izohli savol: **794** — uz/kaa/ru 100% to'la
- Rasmli savol: **710**

## Bazaga qo'llash

Backend papkasidan (`cd backend`, venv faollashgan holda):

```bash
python apply_3lang.py
```

Bu skript: (1) `app.db` ni zaxiralaydi, (2) `seed_3lang/images/*` ni `uploads/images/` ga ko'chiradi, (3) 1224 savolni `app.db` ga import qiladi (eski savollar o'chiriladi).

So'ng backendni qayta ishga tushiring:
```bash
python -m uvicorn app.main:app --reload
```

> Sinov: import allaqachon `app.db.3lang-test` nusxasida tekshirilgan — 1224 savol, uz/kaa/ru 100%.
