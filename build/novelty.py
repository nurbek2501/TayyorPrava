# -*- coding: utf-8 -*-
import json, re, unicodedata, os, sys, collections
sys.stdout.reconfigure(encoding="utf-8")
SRC=os.path.join(os.path.dirname(__file__),"_src")
prav=json.load(open(os.path.join(SRC,"pravaol","questions.json"),encoding="utf-8"))
avto=json.load(open(os.path.join(SRC,"avtotest","avto-test-1000-savol.json"),encoding="utf-8"))["questions"]
APOS="'’`ʻʼ‘´ʹ"
def toks(s):
    if not s: return set()
    s=unicodedata.normalize("NFKD",s).lower()
    s=re.sub(r"^\s*savol\s*-?\s*\d+\s*[:.\-]?\s*","",s)
    s="".join(c for c in s if c not in APOS and not unicodedata.combining(c))
    return {w for w in re.split(r"[^0-9a-zа-я]+",s) if len(w)>2}
def nrm(s):
    s=unicodedata.normalize("NFKD",s or "").lower()
    s="".join(c for c in s if c not in APOS and not unicodedata.combining(c))
    return re.sub(r"[^0-9a-zа-я]+","",s)

P=[{"tok":toks(q["text"]),"ans":{nrm(a) for a in q["answers"]}} for q in prav]
dist=collections.Counter()
novel=[]
for q in avto:
    qt=toks(q["question"]); qa={nrm(o["text"]) for o in q["options"]}
    bj=0; bao=0
    for p in P:
        if not p["tok"] or not qt: continue
        j=len(qt&p["tok"])/len(qt|p["tok"])
        if j>bj:
            bj=j; bao=len(qa&p["ans"])/len(qa) if qa else 0
    b=round(bj,1)
    dist[b]+=1
    # genuinely novel = low text overlap AND low answer overlap
    if bj<0.45 and bao<0.5:
        novel.append((q["id"],q["question"][:70]))
print("Best-Jaccard distribution (avto-test Q vs ALL pravaol):")
for k in sorted(dist):
    print(f"  ~{k}: {dist[k]}")
print()
print("Genuinely NOVEL avto-test Qs (jac<0.45 & ans-overlap<0.5):", len(novel))
for i,(qid,t) in enumerate(novel[:25]):
    print(f"  {qid}: {t}")
