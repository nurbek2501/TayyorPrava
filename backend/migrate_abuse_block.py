"""users.block_reason + users.blocked_at ustunlarini qo'shadi (avto-blok sababi/vaqti).

Ishlatish: cd backend && .venv/Scripts/python.exe migrate_abuse_block.py
Yangi (bo'sh) baza uchun shart emas — create_all bu ustunlarni o'zi yaratadi.
"""
import sqlite3

DB = "app.db"


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cols = {row[1] for row in cur.execute("PRAGMA table_info(users)").fetchall()}
    added = []
    if "block_reason" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN block_reason VARCHAR(255)")
        added.append("block_reason")
    if "blocked_at" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN blocked_at DATETIME")
        added.append("blocked_at")
    if "block_until" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN block_until DATETIME")
        added.append("block_until")
    if "block_count" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN block_count INTEGER NOT NULL DEFAULT 0")
        added.append("block_count")
    conn.commit()
    conn.close()
    print("OK qo'shildi:", added or "(allaqachon mavjud)")


if __name__ == "__main__":
    main()
