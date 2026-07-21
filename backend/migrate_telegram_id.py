"""Migratsiya: users jadvaliga telegram_id ustuni (bir telegram = bir nik).

Ishlatish:  cd backend && python migrate_telegram_id.py
"""
import os
import sqlite3

DB = os.path.join(os.path.dirname(__file__), "app.db")


def main() -> None:
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cols = {r[1] for r in cur.execute("PRAGMA table_info(users)").fetchall()}
    if "telegram_id" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN telegram_id VARCHAR(32)")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS ix_users_telegram_id ON users(telegram_id)"
        )
        print("+ users.telegram_id ustuni + indeks qo'shildi")
    else:
        print("telegram_id allaqachon mavjud")
    con.commit()
    con.close()


if __name__ == "__main__":
    main()
