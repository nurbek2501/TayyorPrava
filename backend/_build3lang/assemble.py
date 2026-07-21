"""manifest + uniq(uz) + cyr(kaa) + ru/*.json  ->  seed_3lang/questions_3lang.json

ru/ ichidagi barcha ru_*.json (id->ru) birlashtiriladi. Har savol uchun
{uz,kaa,ru} to'liq matn, variant va izoh yig'iladi. Rus qamrovi hisobotlanadi.
"""
from __future__ import annotations
import json, os, glob

BE = r"C:\Users\Nurbek\OneDrive\Desktop\Prava pro\backend"
BUILD = os.path.join(BE, "_build3lang")
SEED = os.path.join(BE, "seed_3lang")
PLACEHOLDER_IMG = "/static/images/no-image.png"  # rasmsiz savollar uchun standart rasm

uniq = json.load(open(os.path.join(BUILD, "uniq.json"), encoding="utf-8"))   # id->uz
cyr  = json.load(open(os.path.join(BUILD, "cyr.json"), encoding="utf-8"))    # id->kaa
manifest = json.load(open(os.path.join(BUILD, "manifest.json"), encoding="utf-8"))

# barcha ru bo'laklarini birlashtirish
ru: dict[str, str] = {}
for f in sorted(glob.glob(os.path.join(BUILD, "ru", "ru_*.json"))):
    part = json.load(open(f, encoding="utf-8"))
    for k, v in part.items():
        if v and v.strip():
            ru[k] = v.strip()

def tri(sid: str) -> dict:
    return {"uz": uniq[sid], "kaa": cyr[sid], "ru": ru.get(sid, "")}

questions = []
miss_ru = set()
for m in manifest:
    for sid in [m["q"]] + [o["id"] for o in m["opt"]] + ([m["d"]] if m["d"] else []):
        if sid not in ru:
            miss_ru.add(sid)
    questions.append({
        "topic_id": m["topic_id"],
        "image_url": m["image_url"] or PLACEHOLDER_IMG,
        "order_index": m["order_index"],
        "text": tri(m["q"]),
        "explanation": tri(m["d"]) if m["d"] else None,
        "options": [{"is_correct": o["is_correct"], "text": tri(o["id"])} for o in m["opt"]],
    })

total_ids = len(uniq)
done_ids = sum(1 for sid in uniq if sid in ru)
out = {
    "meta": {
        "source": "prava-pro-1224 (3 tilli: uz lotin, kaa kirill, ru tarjima)",
        "languages": ["uz", "kaa", "ru"],
        "total": len(questions),
        "ru_coverage": f"{done_ids}/{total_ids}",
    },
    "questions": questions,
}
os.makedirs(SEED, exist_ok=True)
json.dump(out, open(os.path.join(SEED, "questions_3lang.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

real_img = sum(1 for q in questions if q["image_url"] != PLACEHOLDER_IMG)
ph_img = len(questions) - real_img
print(f"Yozildi: seed_3lang/questions_3lang.json ({len(questions)} savol)")
print(f"Rasm: {real_img} ta asl rasm, {ph_img} ta placeholder ({PLACEHOLDER_IMG})")
print(f"Rus qamrovi (noyob satr): {done_ids}/{total_ids}  ({100*done_ids//max(total_ids,1)}%)")
def cnt(p): return sum(1 for s in miss_ru if s.startswith(p))
print(f"Tarjima qilinmagan: q={cnt('q')}  o={cnt('o')}  d={cnt('d')}  (jami {len(miss_ru)})")
