# -*- coding: utf-8 -*-
import json, os, re, unicodedata, collections, hashlib, sys
sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(__file__)
OUT = os.path.join(os.path.dirname(ROOT), "prava-pro-1224")
SRC = os.path.join(ROOT, "_src")
Q = json.load(open(os.path.join(OUT, "questions.json"), encoding="utf-8"))
avto = json.load(open(os.path.join(SRC, "avtotest", "avto-test-1000-savol.json"), encoding="utf-8"))["questions"]
prav_orig = json.load(open(os.path.join(SRC, "pravaol", "questions.json"), encoding="utf-8"))

APOS = "'’`ʻʼ‘´ʹ"
def norm(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    s = re.sub(r"^\s*savol\s*-?\s*\d+\s*[:.\-]?\s*", "", s)
    s = "".join(c for c in s if c not in APOS and not unicodedata.combining(c))
    return re.sub(r"[^0-9a-zа-я]+", "", s)
def toks(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    s = re.sub(r"^\s*savol\s*-?\s*\d+\s*[:.\-]?\s*", "", s)
    s = "".join(c for c in s if c not in APOS and not unicodedata.combining(c))
    return {w for w in re.split(r"[^0-9a-zа-я]+", s) if len(w) > 2}
def ihash(rel):
    if not rel: return None
    p = os.path.join(OUT, rel.replace("/", os.sep))
    if not os.path.isfile(p): return ("MISSING", rel)
    return hashlib.md5(open(p, "rb").read()).hexdigest()
def jac(a, b): return len(a & b) / len(a | b) if (a or b) else 0

errors, warns = [], []
for q in Q:
    q["_h"] = ihash(q.get("image")); q["_t"] = toks(q["text"])
    q["_a"] = {norm(a) for a in q["answers"]}
    q["_c"] = norm(q["answers"][q["correct_index"]]) if q["answers"] else ""

# 1 count / ids
print("1) count:", len(Q), "->", "OK" if len(Q)==1224 else "FAIL")
if len(Q)!=1224: errors.append("count")
ids=[q["id"] for q in Q]
print("2) ids 1..N unique:", "OK" if ids==list(range(1,len(Q)+1)) else "FAIL")
if ids!=list(range(1,len(Q)+1)): errors.append("ids")

# 3 field validity
bt=sum(1 for q in Q if not q["text"].strip())
ba=sum(1 for q in Q if len(q["answers"])<2)
bc=sum(1 for q in Q if not(0<=q["correct_index"]<len(q["answers"])))
print(f"3) empty_text={bt} <2ans={ba} bad_correct={bc} ->", "OK" if bt==ba==bc==0 else "FAIL")
if bt or ba or bc: errors.append("fields")

# 4 images
miss=sum(1 for q in Q if isinstance(q["_h"],tuple))
ref={q["image"].split("/")[-1] for q in Q if q.get("image")}
disk=set(os.listdir(os.path.join(OUT,"images")))
orph=disk-ref
print(f"4) with_image={sum(1 for q in Q if q.get('image'))} missing={miss} orphan={len(orph)} ->",
      "OK" if miss==0 and not orph else "FAIL")
if miss: errors.append("missing imgs")
if orph: errors.append(f"orphan imgs {len(orph)}")

# 5 exact duplicate key (text+answers+imagehash)
seen=collections.defaultdict(list)
for q in Q:
    seen[(norm(q["text"]),"|".join(sorted(q["_a"])),str(q["_h"]))].append(q["id"])
exact=[v for v in seen.values() if len(v)>1]
print("5) exact-duplicate groups:", len(exact), "->", "OK" if not exact else "FAIL")
if exact: errors.append("exact dup")

# 6 SEMANTIC near-dup: same image + same answers + SAME correct answer + reworded text
#    (different correct answer on the same diagram = a different question, NOT a dup)
buckets=collections.defaultdict(list)
for q in Q: buckets[str(q["_h"])].append(q)
near=0; near_ex=[]
for rows in buckets.values():
    if len(rows)<2: continue
    for i in range(len(rows)):
        for j in range(i+1,len(rows)):
            a,b=rows[i],rows[j]
            if (jac(a["_t"],b["_t"])>=0.85 and jac(a["_a"],b["_a"])>=0.8
                    and a["_c"]==b["_c"]):
                near+=1
                if len(near_ex)<5: near_ex.append((a["id"],b["id"]))
print("6) true reworded-dup (same img+answers+correct):", near, "->", "OK" if near==0 else "FAIL")
if near: errors.append("semantic dup"); print("   e.g.", near_ex)

# 7 tickets: no nulls; report the synthetic 'extra' bucket (highest ticket)
tk=collections.Counter(q["ticket_id"] for q in Q)
nulls=tk.get(None,0); extra=max(t for t in tk if t is not None)
print(f"7) tickets={len([t for t in tk if t is not None])} null_ticket={nulls} "
      f"extra_bucket=#{extra}({tk[extra]} q) ->", "OK" if nulls==0 else "FAIL")
if nulls: errors.append("null tickets")

# 8 backfill novelty: questions NOT present in original pravaol must be far from everything
porig={norm(q["text"]) for q in prav_orig}
bf=[q for q in Q if norm(q["text"]) not in porig]
worst=0; worst_pair=None
for q in bf:
    for o in Q:
        if o is q: continue
        s=jac(q["_t"],o["_t"])
        if s>worst: worst=s; worst_pair=(q["id"],o["id"])
print(f"8) backfilled(new) count={len(bf)} max_similarity={worst:.2f} {worst_pair} ->",
      "OK" if worst<0.55 else "WARN")
if worst>=0.55: warns.append(f"backfill similarity {worst:.2f}")

# stats
print("\n--- STATS ---")
print("with description:", sum(1 for q in Q if q["description"]))
print("answer-count dist:", dict(sorted(collections.Counter(len(q['answers']) for q in Q).items())))
sz=sum(os.path.getsize(os.path.join(OUT,'images',f)) for f in disk)
print(f"images={len(disk)} total_img={sz/1048576:.1f}MB")
print("\n=== RESULT:", ("ALL CHECKS PASSED ✅" if not errors else f"ERRORS: {errors}"),
      "| warnings:", warns or "none")
