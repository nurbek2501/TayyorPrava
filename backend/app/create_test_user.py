"""Test foydalanuvchi yaratish (telegramsiz, bir martalik yordamchi).

Render Shell'da `backend/` ichida ishga tushiring:

    # Standart test foydalanuvchi (login: Demo2008 / parol: Demo2008!):
    python -m app.create_test_user

    # O'z nik va parolingiz bilan:
    python -m app.create_test_user "MeningNik" "MeningParol"

Agar nik allaqachon mavjud bo'lsa — parolini yangilaydi (qayta yaratmaydi).
Login (kirish) nik: aynan shu qiymatni 'Nik' maydoniga yozing (katta-kichik harf muhim).
"""
from __future__ import annotations

import asyncio
import sys

import app.models  # noqa: F401
from app.core.security import hash_password
from app.crud import users as users_crud
from app.db.session import AsyncSessionLocal
from app.models.enums import Role

DEFAULT_NICK = "Demo2008"
DEFAULT_PASSWORD = "Demo2008!"


async def run(nickname: str, password: str) -> None:
    async with AsyncSessionLocal() as db:
        existing = await users_crud.get_user_by_nickname_exact(db, nickname)
        if existing is not None:
            existing.password_hash = hash_password(password)
            await db.commit()
            print(f"♻️  '{nickname}' allaqachon bor — paroli yangilandi.")
        else:
            user = await users_crud.create_user(
                db,
                name="Test",
                surname="Foydalanuvchi",
                nickname=nickname,
                phone=f"nick:{nickname.lower()}",
                password_hash=hash_password(password),
                role=Role.user,
            )
            await db.commit()
            print(f"✅ Test foydalanuvchi yaratildi (id={user.id}).")
        print("\n──────── KIRISH MA'LUMOTLARI ────────")
        print(f"  Nik   : {nickname}")
        print(f"  Parol : {password}")
        print("  Sayt  : https://tayyorprava.netlify.app/login")
        print("─────────────────────────────────────")


def main() -> None:
    if len(sys.argv) == 1:
        asyncio.run(run(DEFAULT_NICK, DEFAULT_PASSWORD))
    elif len(sys.argv) == 3:
        asyncio.run(run(sys.argv[1], sys.argv[2]))
    else:
        print('Foydalanish: python -m app.create_test_user ["Nik" "Parol"]')
        sys.exit(1)


if __name__ == "__main__":
    main()
