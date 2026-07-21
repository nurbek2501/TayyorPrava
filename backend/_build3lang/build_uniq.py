"""prava-pro-1224 -> 3 tilli tayyorlash: noyob satrlar + topic + kirill.

Chiqaradi:
  uniq.json      {id: uz}                — barcha noyob satr (q*/o*/d*)
  uniq_q.txt     "id<TAB>uz"             — noyob SAVOL matnlari
  uniq_o.txt     "id<TAB>uz"             — noyob VARIANT matnlari
  uniq_d.txt     "id<TAB>uz"             — noyob IZOH matnlari
  manifest.json  [{topic_id,image_url,q_id,opt:[{id,is_correct}],d_id}]
                 — har savolning tuzilmasi (satrlar id orqali)
"""
from __future__ import annotations
import json, os, sys, glob, sqlite3
from collections import OrderedDict, Counter

BE = r"C:\Users\Nurbek\OneDrive\Desktop\Prava pro\backend"
sys.path.insert(0, BE)
os.chdir(BE)

from import_avto1000 import classify, strip_prefix, _norm  # mavzu klassifikatsiya
from import_questions import to_cyrillic                    # lotin -> kirill

BUILD = os.path.join(BE, "_build3lang")
src = json.load(open(os.path.join(BUILD, "src.json"), encoding="utf-8"))
qs = src["questions"]

# eski bazadan matn->mavzu merosi (import_avto1000 bilan bir xil mantiq)
old_map: dict[str, int] = {}
baks = sorted(glob.glob(os.path.join(BE, "app.db.bak-before-empty-*")))
if baks:
    c = sqlite3.connect(baks[-1])
    for t, tid in c.execute(
        "select qt.text,q.topic_id from question_translations qt "
        "join questions q on q.id=qt.question_id where qt.lang='uz'"
    ).fetchall():
        old_map.setdefault(_norm(t), tid)
    c.close()

# noyob satr -> id (tartibli, tur bo'yicha alohida diapazon)
uniq: "OrderedDict[str,str]" = OrderedDict()  # uz -> id
order_q: list[str] = []
order_o: list[str] = []
order_d: list[str] = []

def reg(kind: str, text: str, order: list) -> str | None:
    text = (text or "").strip()
    if not text:
        return None
    if text in uniq:
        return uniq[text]
    n = sum(1 for k in uniq.values() if k[0] == kind) + 1
    sid = f"{kind}{n:04d}"
    uniq[text] = sid
    order.append(text)
    return sid

manifest = []
topics = Counter()
for q in qs:
    qtext = strip_prefix(q.get("question") or "")
    if not qtext:
        continue
    tid = classify(q, old_map)
    topics[tid] += 1
    qid = reg("q", qtext, order_q)
    rasm = q.get("imageUrl")
    image_url = f"/static/{rasm}" if rasm else None
    answers = set(q.get("answer") or [])
    opts = []
    for ov in q.get("options") or []:
        otext = (ov.get("text") or "").strip()
        if not otext:
            continue
        oid = reg("o", otext, order_o)
        opts.append({"id": oid, "is_correct": ov.get("key") in answers})
    desc = (q.get("description") or "").strip()
    did = reg("d", desc, order_d) if desc else None
    manifest.append({
        "topic_id": tid, "image_url": image_url,
        "order_index": int(q.get("id") or 0),
        "q": qid, "opt": opts, "d": did,
    })

# id -> uz (assembler shu fayldan uz va id larni biladi)
id2uz = {sid: uz for uz, sid in uniq.items()}
json.dump(id2uz, open(os.path.join(BUILD, "uniq.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=0)
json.dump(manifest, open(os.path.join(BUILD, "manifest.json"), "w", encoding="utf-8"),
          ensure_ascii=False)

# kirill (deterministik) — assembler ham hisoblaydi, lekin nazorat uchun saqlaymiz
cyr = {sid: to_cyrillic(uz) for sid, uz in id2uz.items()}
json.dump(cyr, open(os.path.join(BUILD, "cyr.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=0)

def dump_txt(name, order):
    with open(os.path.join(BUILD, name), "w", encoding="utf-8") as f:
        for t in order:
            f.write(f"{uniq[t]}\t{t}\n")
dump_txt("uniq_q.txt", order_q)
dump_txt("uniq_o.txt", order_o)
dump_txt("uniq_d.txt", order_d)

print("Savollar (manifest)  :", len(manifest))
print("Noyob savol (q)      :", len(order_q))
print("Noyob variant (o)    :", len(order_o))
print("Noyob izoh (d)       :", len(order_d))
print("JAMI noyob satr      :", len(uniq))
print("Mavzu taqsimoti      :", dict(sorted(topics.items())))
print("\nNamuna kirill (q0001):")
print("  UZ :", order_q[0])
print("  KAA:", cyr["q0001"])
