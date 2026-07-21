"""O'zbek (lotin) -> rus avto-tarjima (Google Translate web endpoint).

Admin "Test tekshirish" bo'limida savol/variantlarni rus tiliga o'girish uchun.
Internet bo'lmasa yoki xizmat ishlamasa, bo'sh satr qaytaradi (xato ko'tarilmaydi).
"""
from __future__ import annotations

import httpx

_URL = "https://translate.googleapis.com/translate_a/single"


async def translate_uz_to_ru(text: str, client: httpx.AsyncClient) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    params = {"client": "gtx", "sl": "uz", "tl": "ru", "dt": "t", "q": text}
    r = await client.get(_URL, params=params, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    data = r.json()
    return "".join(seg[0] for seg in data[0] if seg and seg[0])


async def translate_many(texts: list[str]) -> tuple[list[str], bool]:
    """Bir nechta matnni o'giradi. (tarjimalar, ok) qaytaradi. Birinchi xatodan keyin
    qolganlari bo'sh qoladi (internet yo'q deb hisoblanadi)."""
    out: list[str] = []
    ok = True
    async with httpx.AsyncClient(timeout=10) as client:
        for t in texts:
            if not ok:
                out.append("")
                continue
            try:
                out.append(await translate_uz_to_ru(t, client))
            except Exception:  # noqa: BLE001 — internet yo'q / xizmat ishlamadi
                out.append("")
                ok = False
    return out, ok
