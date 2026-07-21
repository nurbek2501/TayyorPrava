"""Yirik foydalanuvchi oqimi uchun yo'qolgan indekslarni qo'shadi.

create_all mavjud jadvallarga indeks qo'shmaydi — shu skript qo'lda qo'shadi.
Ishlatish: cd backend && .venv/Scripts/python.exe migrate_indexes.py
"""
import sqlite3

DB = "app.db"

INDEXES = [
    ("ix_payments_status", "payments", "status"),
    ("ix_payments_created_at", "payments", "created_at"),
    ("ix_exam_sessions_status", "exam_sessions", "status"),
    ("ix_real_exam_sessions_status", "real_exam_sessions", "status"),
    ("ix_real_exam_sessions_finished_at", "real_exam_sessions", "finished_at"),
    ("ix_users_role", "users", "role"),
    ("ix_users_created_at", "users", "created_at"),
]


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    tables = {r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    created = []
    for name, table, col in INDEXES:
        if table not in tables:
            continue
        cur.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table}({col})")
        created.append(name)
    conn.commit()
    # WAL rejimini ham yoqamiz (bir martalik, faylga yoziladi)
    cur.execute("PRAGMA journal_mode=WAL")
    mode = cur.fetchone()[0]
    conn.commit()
    conn.close()
    print(f"OK: {len(created)} indeks tayyor | journal_mode={mode}")


if __name__ == "__main__":
    main()
