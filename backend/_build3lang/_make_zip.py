import os, zipfile, time, sys, io, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BE = r"C:\Users\Nurbek\OneDrive\Desktop\Prava pro\backend"
SEED = os.path.join(BE, "seed_3lang")
APPDB = os.path.join(BE, "app.db")  # joriy ishlab chiqarish bazasi (yangi 3-tilli)
OUT = r"C:\Users\Nurbek\Downloads\prava-pro-1224-3til-" + time.strftime("%Y%m%d") + ".zip"

n_img = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    z.write(os.path.join(SEED, "questions_3lang.json"), "questions_3lang.json")
    z.write(os.path.join(SEED, "README.md"), "README.md")
    z.write(APPDB, "app_3lang.db")  # tayyor sqlite (joriy app.db nusxasi)
    imgdir = os.path.join(SEED, "images")
    for f in sorted(os.listdir(imgdir)):
        z.write(os.path.join(imgdir, f), f"images/{f}")
        n_img += 1

print(f"Yangilandi: {OUT}")
print(f"Hajm: {round(os.path.getsize(OUT)/1024/1024,2)} MB | rasm: {n_img} (no-image.png ham bor)")
