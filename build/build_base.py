# -*- coding: utf-8 -*-
"""
pravaol (1224, bilet + yengil webp)  +  avto-test (izohlar)
 -> bitta ideal 1224 savolli baza.
 - haqiqiy dublikatlar (matn+javob+rasm tarkibi bayt-bayt bir xil) olib tashlanadi
 - izohlar yuqori aniqlikda biriktiriladi
 - 1224 ga TO'LDIRISH faqat avto-testdagi HAQIQATAN YANGI (pravaolda yo'q) savollardan
"""
import json, re, unicodedata, collections, os, hashlib, shutil, sys
sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(__file__)
SRC = os.path.join(ROOT, "_src")
PRAV_JSON = os.path.join(SRC, "pravaol", "questions.json")
AVTO_JSON = os.path.join(SRC, "avtotest", "avto-test-1000-savol.json")
# rasm manbalari (to'liq arxivdan)
PRAV_IMG_ZIP = r"C:\Users\Nurbek\Downloads\pravaol_savollar_1224.zip"
AVTO_IMG_ZIP = r"C:\Users\Nurbek\Downloads\avto-test-1000.zip"
OUT = os.path.join(os.path.dirname(ROOT), "prava-pro-1224")
OUT_IMG = os.path.join(OUT, "images")

prav = json.load(open(PRAV_JSON, encoding="utf-8"))
avto = json.load(open(AVTO_JSON, encoding="utf-8"))["questions"]

# ---- image bytes from the zips (so we don't keep a 120MB extraction) ----
import zipfile
prav_zip = zipfile.ZipFile(PRAV_IMG_ZIP)
avto_zip = zipfile.ZipFile(AVTO_IMG_ZIP)
prav_names = set(prav_zip.namelist())
avto_names = set(avto_zip.namelist())

# ---------------- normalization ----------------
APOS = "'’`ʻʼ‘´ʹ"
def norm(s):
    if not s: return ""
    s = unicodedata.normalize("NFKD", s).lower()
    s = re.sub(r"^\s*savol\s*-?\s*\d+\s*[:.\-]?\s*", "", s)
    s = "".join(c for c in s if c not in APOS and not unicodedata.combining(c))
    return re.sub(r"[^0-9a-zа-я]+", "", s)
def toks(s):
    if not s: return set()
    s = unicodedata.normalize("NFKD", s).lower()
    s = re.sub(r"^\s*savol\s*-?\s*\d+\s*[:.\-]?\s*", "", s)
    s = "".join(c for c in s if c not in APOS and not unicodedata.combining(c))
    return {w for w in re.split(r"[^0-9a-zа-я]+", s) if len(w) > 2}
def anskey(a): return "|".join(sorted(norm(x) for x in a))
def strip_prefix(s): return re.sub(r"^\s*savol\s*-?\s*\d+\s*[:.\-]?\s*", "", s, flags=re.I).strip()

def hash_bytes(b): return hashlib.md5(b).hexdigest()
def prav_img_hash(rel):
    if not rel: return None
    return hash_bytes(prav_zip.read(rel)) if rel in prav_names else ("MISSING", rel)

for q in prav:
    q["_nt"] = norm(q["text"]); q["_ak"] = anskey(q["answers"]); q["_ih"] = prav_img_hash(q.get("image"))
    q["_tok"] = toks(q["text"]); q["_ans"] = {norm(a) for a in q["answers"]}

# ---------------- avto-test index (descriptions) ----------------
avto_idx = [{
    "q": q, "tok": toks(q["question"]), "nt": norm(q["question"]),
    "ans": {norm(o["text"]) for o in q["options"]}, "desc": (q.get("description") or "").strip(),
} for q in avto]
avto_by_nt = {}
for a in avto_idx:
    if a["nt"]: avto_by_nt.setdefault(a["nt"], a)

def find_desc(text, answers):
    nt = norm(text)
    if nt in avto_by_nt and avto_by_nt[nt]["desc"]:
        return avto_by_nt[nt]["desc"]
    qt = toks(text); qa = {norm(x) for x in answers}
    if not qt: return None
    best=None; bj=0; bao=0
    for a in avto_idx:
        if not a["tok"]: continue
        j = len(qt & a["tok"]) / len(qt | a["tok"])
        if j > bj:
            bj=j; best=a; bao=(len(qa & a["ans"])/len(qa)) if qa else 0
    if best and best["desc"] and (bj >= 0.85 or (bj >= 0.60 and bao >= 0.60)):
        return best["desc"]
    return None

# ---------------- 1) DEDUP (text + answers + image-content) ----------------
groups = collections.OrderedDict()
for q in prav:
    groups.setdefault((q["_nt"], q["_ak"], str(q["_ih"])), []).append(q)
unique, removed = [], []
for rows in groups.values():
    if len(rows) == 1: unique.append(rows[0]); continue
    rep = min(rows, key=lambda r: r["id"])
    unique.append(rep)
    removed.extend(r["id"] for r in rows if r is not rep)
print(f"pravaol input          : {len(prav)}")
print(f"exact-duplicate removed: {len(removed)}  ids={sorted(removed)}")

# Pass 2: REWORDED duplicates = same image + same answer-set + same correct-answer-text
# + high word overlap. (Different correct answer => different question, kept.)
def corr_text(q): return norm(q["answers"][q["correct_index"]]) if q["answers"] else ""
key2 = collections.OrderedDict()
for q in unique:
    key2.setdefault((str(q["_ih"]), q["_ak"], corr_text(q)), []).append(q)
unique2, removed2 = [], []
for rows in key2.values():
    if len(rows) == 1: unique2.append(rows[0]); continue
    kept = []
    for q in rows:
        dup = next((k for k in kept
                    if (len(q["_tok"] & k["_tok"]) / len(q["_tok"] | k["_tok"])
                        if (q["_tok"] or k["_tok"]) else 0) >= 0.85), None)
        if dup is None: kept.append(q)
        else: removed2.append(q["id"])
    unique2.extend(kept)
unique = unique2
print(f"reworded-dup removed   : {len(removed2)}  ids={sorted(removed2)}")
removed = removed + removed2
print(f"unique after dedup     : {len(unique)}")

# ---------------- 2) descriptions ----------------
desc_hits = 0
for q in unique:
    d = find_desc(q["text"], q["answers"]); q["description"] = d or ""
    if d: desc_hits += 1
print(f"descriptions attached  : {desc_hits}/{len(unique)}")

# ---------------- 3) backfill ONLY from genuinely-novel avto-test ----------------
TARGET = 1224
need = TARGET - len(unique)
P = [(q["_tok"], q["_ans"]) for q in unique]
def is_novel(qtok, qans):
    bj=0; bao=0
    for ptok, pans in P:
        if not ptok or not qtok: continue
        j = len(qtok & ptok)/len(qtok | ptok)
        if j > bj:
            bj=j; bao=len(qans & pans)/len(qans) if qans else 0
    return bj < 0.45 and bao < 0.5

backfill = []
seen_bf = set()
for q in avto:
    if len(backfill) >= need: break
    qtok = toks(q["question"]); qans = {norm(o["text"]) for o in q["options"]}
    nt = norm(q["question"])
    if not nt or nt in seen_bf: continue
    ans_texts = [o["text"] for o in q["options"]]
    akeys = set(q.get("answer") or [])
    ci = next((i for i,o in enumerate(q["options"]) if o["key"] in akeys), None)
    if ci is None or len(ans_texts) < 2: continue
    if not is_novel(qtok, qans): continue       # <-- guarantees no semantic duplicate
    seen_bf.add(nt)
    backfill.append({
        "text": strip_prefix(q["question"]), "image": q.get("imageUrl"),
        "correct_index": ci, "answers": ans_texts,
        "description": (q.get("description") or "").strip(), "_src": "avto",
    })
print(f"backfill needed/done   : {need}/{len(backfill)}  (genuinely novel)")

# ---------------- 4) tickets: null + backfill -> ticket 63 ----------------
max_ticket = max((q.get("ticket_id") or 0) for q in unique)
EXTRA = max_ticket + 1
for q in unique:
    if not q.get("ticket_id"): q["ticket_id"] = EXTRA
for b in backfill: b["ticket_id"] = EXTRA

final = sorted(unique, key=lambda q: (q["ticket_id"], q["id"])) + backfill

# ---------------- 5) write images + json ----------------
import time, stat
def _onerr(func, path, exc):
    try: os.chmod(path, stat.S_IWRITE); func(path)
    except Exception: pass
if os.path.isdir(OUT):
    for _ in range(8):
        shutil.rmtree(OUT, onerror=_onerr)
        if not os.path.isdir(OUT): break
        time.sleep(0.6)
os.makedirs(OUT_IMG, exist_ok=True)
keep_names = set()   # track referenced images to prune orphans if dir survived
out_list = []; bf_n = 0
for newid, q in enumerate(final, start=1):
    img = q.get("image"); out_img = None
    if img:
        if q.get("_src") == "avto":
            bf_n += 1; name = f"extra_{bf_n:03d}{os.path.splitext(img)[1].lower()}"
            data = avto_zip.read(img) if img in avto_names else None
        else:
            name = os.path.basename(img)
            data = prav_zip.read(img) if img in prav_names else None
        if data:
            open(os.path.join(OUT_IMG, name), "wb").write(data)
            out_img = f"images/{name}"; keep_names.add(name)
    out_list.append({
        "id": newid, "ticket_id": q["ticket_id"], "text": q["text"],
        "image": out_img, "correct_index": q["correct_index"],
        "answers": q["answers"], "description": q.get("description", ""),
    })

# prune orphan images if the old dir survived the lock
for fn in os.listdir(OUT_IMG):
    if fn not in keep_names:
        try: os.remove(os.path.join(OUT_IMG, fn))
        except Exception: pass

json.dump(out_list, open(os.path.join(OUT, "questions.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
json.dump({
    "title": "Prava Pro — yagona test bazasi (1224)",
    "total": len(out_list),
    "tickets": len({q["ticket_id"] for q in out_list}),
    "with_description": sum(1 for q in out_list if q["description"]),
    "with_image": sum(1 for q in out_list if q["image"]),
    "removed_duplicates": len(removed),
    "backfilled_from_avto_test": len(backfill),
    "extra_ticket": EXTRA,
    "source": f"pravaol_savollar_1224 (asos, bilet 1-{max_ticket}) + avto-test-1000 "
              f"(izohlar & {len(backfill)} ta yangi savol)",
}, open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# transparency report
with open(os.path.join(OUT, "MERGE_REPORT.txt"), "w", encoding="utf-8") as f:
    f.write("OLIB TASHLANGAN DUBLIKATLAR (asl pravaol id):\n  " + ", ".join(map(str, sorted(removed))) + "\n\n")
    f.write(f"AVTO-TEST'DAN QO'SHILGAN YANGI SAVOLLAR ({EXTRA}-bilet, 'Qo'shimcha'):\n")
    for b in backfill: f.write("  - " + b["text"][:90] + "\n")
print(f"FINAL                  : {len(out_list)} savol -> {OUT}")
