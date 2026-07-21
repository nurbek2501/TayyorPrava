# -*- coding: utf-8 -*-
"""Migratsiya: payments jadvaliga `category` ustunini qo'shadi va eski yozuvlarni backfill qiladi.

Daromad statistikasini aniq ajratish uchun:
  - tariff_id bor            -> 'tariff'    (obuna tarifi)
  - tariff_id NULL, phone='' -> 'real_exam' (real imtihon — create_payment(phone=""))
  - tariff_id NULL, phone!=''-> 'teacher'   (ustoz maslahati — Payment(phone=user.phone))

Idempotent: ustun allaqachon bo'lsa qayta qo'shmaydi; backfill faqat NULL category'larga.
Ishga tushirish:  cd backend && .venv/Scripts/python.exe migrate_payment_category.py
"""
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

DB = "app.db"
con = sqlite3.connect(DB)
cur = con.cursor()

cols = {r[1] for r in cur.execute("PRAGMA table_info(payments)").fetchall()}
if "category" not in cols:
    cur.execute("ALTER TABLE payments ADD COLUMN category VARCHAR(20)")
    print("  + `category` ustuni qo'shildi")
else:
    print("  = `category` ustuni allaqachon mavjud")

cur.execute("CREATE INDEX IF NOT EXISTS ix_payments_category ON payments(category)")

# Backfill — faqat hali belgilanmagan (NULL) yozuvlar
n_tariff = cur.execute(
    "UPDATE payments SET category='tariff' "
    "WHERE category IS NULL AND tariff_id IS NOT NULL"
).rowcount
n_realexam = cur.execute(
    "UPDATE payments SET category='real_exam' "
    "WHERE category IS NULL AND tariff_id IS NULL AND (phone IS NULL OR phone='')"
).rowcount
n_teacher = cur.execute(
    "UPDATE payments SET category='teacher' "
    "WHERE category IS NULL AND tariff_id IS NULL AND phone IS NOT NULL AND phone<>''"
).rowcount

con.commit()

print(f"  backfill: tariff={n_tariff}  real_exam={n_realexam}  teacher={n_teacher}")

print("\n  Yakuniy taqsimot:")
for row in cur.execute(
    "SELECT COALESCE(category,'(NULL)'), COUNT(*), COALESCE(SUM(amount),0) "
    "FROM payments WHERE status='paid' GROUP BY category ORDER BY 2 DESC"
).fetchall():
    print(f"    {row[0]:<12} yozuv={row[1]:<5} summa={row[2]}")

con.close()
print("\nMigratsiya tugadi.")
