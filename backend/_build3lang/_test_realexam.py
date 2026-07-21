import asyncio, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r"C:\Users\Nurbek\OneDrive\Desktop\Prava pro\backend")
os.chdir(r"C:\Users\Nurbek\OneDrive\Desktop\Prava pro\backend")
from app.db.session import AsyncSessionLocal, engine
from app.crud import questions as qcrud

async def main():
    async with AsyncSessionLocal() as db:
        qs = await qcrud.get_random_questions(db, 20)  # real imtihon aynan shuni ishlatadi
        print(f"Real imtihon uchun random tanlandi: {len(qs)} savol\n")
        langs_ok = img_ph = img_real = 0
        for q in qs:
            tr = {t.lang.value if hasattr(t.lang,'value') else t.lang: t.text for t in q.translations}
            if tr.get('uz','').strip() and tr.get('kaa','').strip() and tr.get('ru','').strip():
                langs_ok += 1
            if q.image_url and 'no-image' in q.image_url: img_ph += 1
            elif q.image_url: img_real += 1
        print(f"3 tili ham to'la: {langs_ok}/20")
        print(f"Rasm: {img_real} asl, {img_ph} placeholder\n")
        print("--- Dastlabki 2 savol namunasi (3 tilda) ---")
        for q in qs[:2]:
            tr = {t.lang.value if hasattr(t.lang,'value') else t.lang: t.text for t in q.translations}
            print("img:", q.image_url)
            print("  uz :", tr.get('uz'))
            print("  kaa:", tr.get('kaa'))
            print("  ru :", tr.get('ru'))
            print()
    await engine.dispose()

asyncio.run(main())
