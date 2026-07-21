import os, json, zipfile, shutil, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BE = r"C:\Users\Nurbek\OneDrive\Desktop\Prava pro\backend"
ZIP = r"C:\Users\Nurbek\Downloads\yol-belgilari.zip"
SEED = os.path.join(BE, "seed_belgilar")
IMG = os.path.join(SEED, "rasmlar")
os.makedirs(IMG, exist_ok=True)

nimg = 0
with zipfile.ZipFile(ZIP) as z:
    for info in z.infolist():
        name = info.filename.replace("\\","/")
        if name.endswith("/"): continue
        leaf = os.path.basename(name)
        if leaf.lower().endswith((".gif",".png",".jpg",".jpeg",".webp")):
            with z.open(info) as s, open(os.path.join(IMG, leaf),"wb") as o:
                shutil.copyfileobj(s,o); nimg += 1
        elif leaf == "yol-belgilari.json":
            data = json.load(z.open(info))
            json.dump(data, open(os.path.join(SEED,"yol-belgilari.json"),"w",encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"Rasm chiqarildi: {nimg}")
cats = data["categories"]
print(f"Kategoriyalar: {len(cats)} | jami belgi: {sum(len(c['signs']) for c in cats)}")
# noyob nomlar
names = {}
for c in cats:
    for s in c["signs"]:
        names[s["name"]] = names.get(s["name"],0)+1
print(f"Noyob belgi nomi: {len(names)}")
# rasm mavjudligi
present = set(os.listdir(IMG))
miss = [s["imagePath"] for c in cats for s in c["signs"] if os.path.basename(s["imagePath"]) not in present]
print(f"Rasm yetishmovchilik: {len(miss)}", miss[:5])
# kategoriya nomlari
print("\n--- KATEGORIYALAR ---")
for c in cats: print(f"  [{len(c['signs'])}] {c['category']}")
# noyob nomlarni faylga
with open(os.path.join(BE,"_build_belgilar","uniq_names.txt"),"w",encoding="utf-8") as f:
    for n in names: f.write(n+"\n")
print(f"\nNoyob nomlar -> _build_belgilar/uniq_names.txt ({len(names)})")
