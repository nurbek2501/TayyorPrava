"""3 tilli (uz/kaa/ru) bazani ASOSIY app.db ga xavfsiz qo'llash.

Bajaradi:
  1) app.db ni zaxiralaydi (app.db.bak-before-3lang-<vaqt>)
  2) seed_3lang/images/* ni uploads/images/ ga ko'chiradi (rasm yo'li /static/images/...)
  3) import_3lang.py orqali 1224 savolni uz/kaa/ru bilan import qiladi (--replace)

Foydalanish:
    python apply_3lang.py
"""
from __future__ import annotations
import os, shutil, subprocess, sys, time
from pathlib import Path

BE = Path(__file__).resolve().parent
APP_DB = BE / "app.db"
SEED = BE / "seed_3lang"
SEED_IMG = SEED / "images"
UPLOAD_IMG = BE / "uploads" / "images"
JSON = SEED / "questions_3lang.json"


def main() -> None:
    if not JSON.exists():
        sys.exit(f"Topilmadi: {JSON}")

    # 1) zaxira
    if APP_DB.exists():
        bak = BE / f"app.db.bak-before-3lang-{time.strftime('%Y%m%d-%H%M%S')}"
        shutil.copy2(APP_DB, bak)
        print(f"[1/3] Zaxira olindi: {bak.name}")
    else:
        print("[1/3] app.db topilmadi — yangidan yaratiladi")

    # 2) rasmlar
    UPLOAD_IMG.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in SEED_IMG.iterdir():
        if f.is_file():
            shutil.copy2(f, UPLOAD_IMG / f.name)
            n += 1
    print(f"[2/3] Rasm ko'chirildi: {n} ta -> uploads/images/")

    # 3) import (asosiy app.db ga, .env DATABASE_URL)
    print("[3/3] Import boshlandi...")
    r = subprocess.run(
        [sys.executable, str(BE / "import_3lang.py"), str(JSON), "--replace"],
        cwd=str(BE),
    )
    if r.returncode != 0:
        sys.exit("Import xato bilan tugadi.")
    print("\nTayyor. Backend qayta ishga tushiriladi: python -m uvicorn app.main:app --reload")


if __name__ == "__main__":
    main()
