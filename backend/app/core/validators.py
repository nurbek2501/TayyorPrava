"""Nickname va parol uchun server tomonidagi tekshiruv qoidalari.

Frontend jonli tekshiradi, lekin bu yer — yakuniy/ishonchli himoya.
Qoidalar frontenddagi qoidalar bilan bir xil bo'lishi shart.
"""
from __future__ import annotations

import re
from typing import Optional

NICKNAME_MIN = 8
NICKNAME_MAX = 32
PASSWORD_MIN = 8
PASSWORD_MAX = 128

_ALNUM_RE = re.compile(r"^[A-Za-z0-9]+$")


def nickname_error(nickname: str) -> Optional[str]:
    """Nickname qoidalarga mos bo'lmasa — sababini (o'zbekcha) qaytaradi, aks holda None."""
    nick = (nickname or "").strip()
    if len(nick) < NICKNAME_MIN:
        return f"Nik kamida {NICKNAME_MIN} ta belgidan iborat bo'lishi kerak"
    if len(nick) > NICKNAME_MAX:
        return f"Nik {NICKNAME_MAX} ta belgidan oshmasligi kerak"
    if not _ALNUM_RE.match(nick):
        return "Nik faqat lotin harflar va raqamlardan iborat bo'lishi kerak"
    if not any(c.isupper() for c in nick):
        return "Nikda kamida bitta katta harf bo'lishi kerak"
    if not any(c.isdigit() for c in nick):
        return "Nikda kamida bitta raqam bo'lishi kerak"
    return None


def password_error(password: str) -> Optional[str]:
    """Parol qoidalarga mos bo'lmasa — sababini (o'zbekcha) qaytaradi, aks holda None."""
    pw = password or ""
    if len(pw) < PASSWORD_MIN:
        return f"Parol kamida {PASSWORD_MIN} ta belgidan iborat bo'lishi kerak"
    if len(pw) > PASSWORD_MAX:
        return f"Parol {PASSWORD_MAX} ta belgidan oshmasligi kerak"
    if not any(c.isalpha() for c in pw):
        return "Parolda kamida bitta harf bo'lishi kerak"
    if not any(c.isdigit() for c in pw):
        return "Parolda kamida bitta raqam bo'lishi kerak"
    return None
