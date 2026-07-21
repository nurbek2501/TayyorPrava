"""users.bonus_balance ustunini qo'shadi (promokod bonusi balansi).

Ishlatish: cd backend && .venv/Scripts/python.exe migrate_bonus_balance.py
"""
import sqlite3

DB = "app.db"


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cols = {row[1] for row in cur.execute("PRAGMA table_info(users)").fetchall()}
    if "bonus_balance" in cols:
        print("bonus_balance allaqachon mavjud — o'tkazib yuborildi")
    else:
        cur.execute(
            "ALTER TABLE users ADD COLUMN bonus_balance INTEGER NOT NULL DEFAULT 0"
        )
        conn.commit()
        print("OK: users.bonus_balance qo'shildi")
    conn.close()


if __name__ == "__main__":
    main()
