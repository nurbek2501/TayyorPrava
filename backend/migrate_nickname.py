"""Bir martalik migratsiya: users jadvaliga surname + nickname ustunlari.

nickname-asosli ro'yxat/kirish uchun. SQLite ALTER TABLE ADD COLUMN ishlatadi
(mavjud ma'lumotlarga tegmaydi). Demo userga test uchun nik beradi.

Ishlatish:  cd backend && python migrate_nickname.py
"""
import os
import sqlite3

DB = os.path.join(os.path.dirname(__file__), "app.db")


def main() -> None:
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cols = {r[1] for r in cur.execute("PRAGMA table_info(users)").fetchall()}

    if "surname" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN surname VARCHAR(255)")
        print("+ surname ustuni qo'shildi")
    if "nickname" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN nickname VARCHAR(32)")
        print("+ nickname ustuni qo'shildi")

    # Noyob indeks (SQLite'da bir nechta NULL ruxsat etiladi)
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_nickname ON users(nickname)"
    )
    print("+ ix_users_nickname noyob indeks")

    # Demo userga test uchun nik (parol o'zgarmaydi: user123)
    cur.execute(
        "UPDATE users SET nickname='Demo1234', surname='Test' "
        "WHERE phone='+99891000000' AND (nickname IS NULL OR nickname='')"
    )
    if cur.rowcount:
        print("+ demo userga nik berildi: Demo1234")

    con.commit()
    info = cur.execute("PRAGMA table_info(users)").fetchall()
    con.close()
    print("\nTayyor. users ustunlari:")
    for r in info:
        print(f"   {r[1]} ({r[2]})")


if __name__ == "__main__":
    main()
