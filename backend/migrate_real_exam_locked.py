"""Migratsiya: settings jadvaliga real_exam_locked ustuni.

Admin real imtihon bo'limini vaqtincha butunlay yopishi (hech kim kira olmasligi)
uchun. Idempotent: ustun allaqachon bo'lsa qayta qo'shmaydi.

Ishlatish:  cd backend && python migrate_real_exam_locked.py
"""
import os
import sqlite3

DB = os.path.join(os.path.dirname(__file__), "app.db")


def main() -> None:
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cols = {r[1] for r in cur.execute("PRAGMA table_info(settings)").fetchall()}
    if "real_exam_locked" not in cols:
        cur.execute(
            "ALTER TABLE settings ADD COLUMN real_exam_locked BOOLEAN DEFAULT 0"
        )
        cur.execute(
            "UPDATE settings SET real_exam_locked = 0 WHERE real_exam_locked IS NULL"
        )
        print("+ settings.real_exam_locked qo'shildi (yopiq emas)")
    else:
        print("real_exam_locked allaqachon mavjud")
    con.commit()
    con.close()


if __name__ == "__main__":
    main()
