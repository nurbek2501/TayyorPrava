"""Migratsiya: settings jadvaliga real_exam_restore_max_mistakes ustuni.

"Guvohnomadan mahrum bo'lganlar" (qayta topshirish, 50 savol) rejimi uchun
MUSTAQIL ruxsat etilgan xato soni — real_exam_max_mistakes (20 savol, birinchi
marta rejimi) dan proportsional hisoblanmasdan, admin ikkalasini alohida sozlaydi.

Ishlatish:  cd backend && python migrate_real_exam_restore_mistakes.py
"""
import os
import sqlite3

DB = os.path.join(os.path.dirname(__file__), "app.db")


def main() -> None:
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cols = {r[1] for r in cur.execute("PRAGMA table_info(settings)").fetchall()}
    if "real_exam_restore_max_mistakes" not in cols:
        cur.execute(
            "ALTER TABLE settings ADD COLUMN real_exam_restore_max_mistakes "
            "INTEGER DEFAULT 4"
        )
        cur.execute(
            "UPDATE settings SET real_exam_restore_max_mistakes = 4 "
            "WHERE real_exam_restore_max_mistakes IS NULL"
        )
        print("+ settings.real_exam_restore_max_mistakes qo'shildi (4 ta xato)")
    else:
        print("real_exam_restore_max_mistakes allaqachon mavjud")
    con.commit()
    con.close()


if __name__ == "__main__":
    main()
