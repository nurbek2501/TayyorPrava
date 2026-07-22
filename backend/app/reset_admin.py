"""Admin login/parolini ko'rish yoki qayta o'rnatish (bir martalik yordamchi).

Render Shell'da `backend/` ichida ishga tushiring:

    # 1) Mavjud admin(lar)ning ANIQ loginini ko'rish (hech narsani o'zgartirmaydi):
    python -m app.reset_admin

    # 2) Admin login va parolini qayta o'rnatish:
    python -m app.reset_admin "YangiLogin" "YangiParol"

Eslatma: admin login `User.phone` ustunida saqlanadi (nickname emas).
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

import app.models  # noqa: F401 — modellarni ro'yxatga oladi
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.enums import Role
from app.models.user import User


async def _list_admins(db) -> list[User]:
    return list(
        (await db.execute(select(User).where(User.role == Role.admin))).scalars().all()
    )


async def show() -> None:
    async with AsyncSessionLocal() as db:
        admins = await _list_admins(db)
        if not admins:
            print("❌ Bazada admin (role=admin) topilmadi.")
            return
        print(f"✅ {len(admins)} ta admin topildi:")
        for a in admins:
            print(f"  • login (phone) = {a.phone!r} | ism = {a.name!r} | email = {a.email!r}")
        print("\nKirishda 'Nik' maydoniga aynan yuqoridagi login (phone) qiymatini yozing.")


async def reset(new_login: str, new_password: str) -> None:
    async with AsyncSessionLocal() as db:
        admins = await _list_admins(db)
        if not admins:
            print("❌ Admin topilmadi — qayta o'rnatib bo'lmaydi.")
            return
        admin = admins[0]
        old_login = admin.phone
        admin.phone = new_login
        admin.password_hash = hash_password(new_password)
        await db.commit()
        print(f"✅ Admin yangilandi: login {old_login!r} -> {new_login!r}, parol o'rnatildi.")
        print("Endi /login sahifasida shu login va parol bilan kiring.")


def main() -> None:
    if len(sys.argv) == 1:
        asyncio.run(show())
    elif len(sys.argv) == 3:
        asyncio.run(reset(sys.argv[1], sys.argv[2]))
    else:
        print("Foydalanish:")
        print("  python -m app.reset_admin                    # admin loginini ko'rish")
        print('  python -m app.reset_admin "Login" "Parol"    # qayta o\'rnatish')
        sys.exit(1)


if __name__ == "__main__":
    main()
