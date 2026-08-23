"""Nickname va parol uchun server tomonidagi tekshiruv qoidalari.

Frontend jonli tekshiradi, lekin bu yer — yakuniy/ishonchli himoya.
Qoidalar frontenddagi qoidalar bilan bir xil bo'lishi shart
(`frontend/src/lib/authValidation.ts`).
"""
from __future__ import annotations

import re
from typing import Optional

NICKNAME_MIN = 2
NICKNAME_MAX = 32
PASSWORD_MIN = 4
PASSWORD_MAX = 128

# Harf, raqam, pastki chiziq va tire. Bo'sh joy/emoji ATAYIN taqiqlangan:
# nickname bot orqali ham yuboriladi (foydalanuvchi uni chatga yozadi), bo'sh joy
# yoki emoji bo'lsa xabar buzilib, nik topilmay qolishi mumkin.
_NICK_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def nickname_error(nickname: str) -> Optional[str]:
    """Nickname qoidalarga mos bo'lmasa — sababini (o'zbekcha) qaytaradi, aks holda None."""
    nick = (nickname or "").strip()
    if len(nick) < NICKNAME_MIN:
        return f"Nik kamida {NICKNAME_MIN} ta belgidan iborat bo'lishi kerak"
    if len(nick) > NICKNAME_MAX:
        return f"Nik {NICKNAME_MAX} ta belgidan oshmasligi kerak"
    if not _NICK_RE.match(nick):
        return "Nikda faqat lotin harflar, raqamlar, _ va - belgilari bo'lishi mumkin"
    return None


def password_error(password: str) -> Optional[str]:
    """Parol qoidalarga mos bo'lmasa — sababini (o'zbekcha) qaytaradi, aks holda None."""
    pw = password or ""
    if len(pw) < PASSWORD_MIN:
        return f"Parol kamida {PASSWORD_MIN} ta belgidan iborat bo'lishi kerak"
    if len(pw) > PASSWORD_MAX:
        return f"Parol {PASSWORD_MAX} ta belgidan oshmasligi kerak"
    return None
