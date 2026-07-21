"""users.telegram_id ni UNIQUE qiladi — bir telegram = bir user (DB darajasida).

Konkurent verify-code race'ini oldini oladi. Avval dublikatlarni tekshiradi.
Ishlatish: cd backend && .venv/Scripts/python.exe migrate_telegram_unique.py
"""
import sqlite3

DB = "app.db"


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    dups = cur.execute(
        "SELECT telegram_id, COUNT(*) c FROM users "
        "WHERE telegram_id IS NOT NULL AND telegram_id != '' "
        "GROUP BY telegram_id HAVING c > 1"
    ).fetchall()
    if dups:
        print("OGOHLANTIRISH: dublikat telegram_id topildi, UNIQUE indeks yaratilmadi:")
        for tg, c in dups:
            print(f"  telegram_id={tg} -> {c} ta user")
        print("Avval dublikatlarni qo'lda hal qiling, keyin qayta ishga tushiring.")
        conn.close()
        return

    # Eski (non-unique) indeksni unique bilan almashtiramiz.
    cur.execute("DROP INDEX IF EXISTS ix_users_telegram_id")
    cur.execute("CREATE UNIQUE INDEX ix_users_telegram_id ON users(telegram_id)")
    conn.commit()
    conn.close()
    print("OK: users.telegram_id UNIQUE indeks yaratildi")


if __name__ == "__main__":
    main()
