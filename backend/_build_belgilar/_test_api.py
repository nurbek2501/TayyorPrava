import json, sys, io, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
with urllib.request.urlopen("http://127.0.0.1:8000/api/road-signs", timeout=8) as r:
    d = json.load(r)
print("title.ru :", d["title"]["ru"])
print("totalSigns:", d["totalSigns"], "| kategoriyalar:", len(d["categories"]))
for c in d["categories"]:
    print(f"  [{c['code']}] {c['category']['uz']} / {c['category']['ru']} ({c['count']})")
s = d["categories"][0]["signs"][0]
print("\n1-belgi:", s["code"])
print("  uz :", s["name"]["uz"]); print("  kaa:", s["name"]["kaa"]); print("  ru :", s["name"]["ru"])
print("  img:", s["imageUrl"])
# bo'sh til bormi
empty = sum(1 for c in d["categories"] for s in c["signs"] for l in ("uz","kaa","ru") if not s["name"][l].strip())
print("\nBo'sh til (jami):", empty)
