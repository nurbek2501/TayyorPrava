import json
from collections import Counter

path = r"C:\Users\Nurbek\Downloads\avtotest_600_savollar.json"
data = json.load(open(path, encoding="utf-8"))
qs = data["savollar"]
print("total:", len(qs))

bilets = Counter(q["bilet"] for q in qs)
print("bilet count:", len(bilets), "min:", min(bilets), "max:", max(bilets))
print("per-bilet distinct sizes:", Counter(bilets.values()))

imgs = [q["rasm"] for q in qs if q.get("rasm")]
print("with image:", len(imgs))
print("rasm samples:", imgs[:4])

vc = Counter(len(q["uz_lotin"]["variantlar"]) for q in qs)
print("variant-count distribution:", dict(vc))

missing = sum(1 for q in qs if not (q.get("uz_lotin") and q.get("uz_kirill") and q.get("rus")))
print("missing a language:", missing)

bad_correct = sum(
    1 for q in qs
    if sum(1 for v in q["uz_lotin"]["variantlar"] if v.get("togri")) != 1
)
print("not exactly 1 correct:", bad_correct)

# key sets
print("question keys:", sorted(qs[0].keys()))
