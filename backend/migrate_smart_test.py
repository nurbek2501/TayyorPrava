"""settings ga smart_test ustunlarini qo'shadi (smart_progress jadvalini create_all yaratadi).

Ishlatish: cd backend && .venv/Scripts/python.exe migrate_smart_test.py
"""
import sqlite3

DB = "app.db"
COLS = {
    "smart_test_streak": "INTEGER NOT NULL DEFAULT 5",
    "smart_test_advice_percent": "INTEGER NOT NULL DEFAULT 50",
}


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    have = {row[1] for row in cur.execute("PRAGMA table_info(settings)").fetchall()}
    added = []
    for col, decl in COLS.items():
        if col not in have:
            cur.execute(f"ALTER TABLE settings ADD COLUMN {col} {decl}")
            added.append(col)
    conn.commit()
    conn.close()
    print("OK:", ", ".join(added) if added else "barcha ustunlar mavjud edi")


if __name__ == "__main__":
    main()
