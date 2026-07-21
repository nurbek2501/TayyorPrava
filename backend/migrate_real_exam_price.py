"""Migratsiya: settings jadvaliga real_exam_price (so'm) ustuni.

real_exam_access jadvali create_all bilan avtomatik yaratiladi (migratsiya shart emas).

Ishlatish:  cd backend && python migrate_real_exam_price.py
"""
import os
import sqlite3

DB = os.path.join(os.path.dirname(__file__), "app.db")


def main() -> None:
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cols = {r[1] for r in cur.execute("PRAGMA table_info(settings)").fetchall()}
    if "real_exam_price" not in cols:
        cur.execute(
            "ALTER TABLE settings ADD COLUMN real_exam_price INTEGER DEFAULT 12000"
        )
        cur.execute(
            "UPDATE settings SET real_exam_price = 12000 WHERE real_exam_price IS NULL"
        )
        print("+ settings.real_exam_price qo'shildi (12000 so'm)")
    else:
        print("real_exam_price allaqachon mavjud")
    con.commit()
    con.close()


if __name__ == "__main__":
    main()
