# -*- coding: utf-8 -*-
import json, os, sys, collections, unicodedata, hashlib, re
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prava-pro-1224")
doc = json.load(open(os.path.join(OUT, "questions.json"), encoding="utf-8"))
Q = doc["questions"]
errors, warns = [], []

# 1) wrapper + count + ids
print("1) total:", doc.get("total"), "| questions:", len(Q),
      "->", "OK" if doc.get("total")==len(Q)==1224 else "FAIL")
if len(Q)!=1224: errors.append("count")
ids=[q["id"] for q in Q]
print("2) ids unique:", "OK" if len(set(ids))==len(ids)==1224 else "FAIL")
if len(set(ids))!=1224: errors.append("ids")

# 3) schema validity (import_avto1000.py kutadigan maydonlar)
bad=0
for q in Q:
    ok = (isinstance(q.get("question"),str) and q["question"].strip()
          and isinstance(q.get("options"),list) and len(q["options"])>=2
          and all(isinstance(o.get("key"),str) and isinstance(o.get("text"),str) and o["text"].strip() for o in q["options"])
          and isinstance(q.get("answer"),list) and len(q["answer"])>=1
          and all(any(o["key"]==a for o in q["options"]) for a in q["answer"]))
    if not ok: bad+=1
print("3) schema valid (q/options/answer-key):", "OK" if bad==0 else f"FAIL ({bad})")
if bad: errors.append("schema")

# 4) ORFOGRAFIYA: ruxsat etilgan bo'lmagan belgilar qolmaganini tekshir
#    ruxsat: ASCII, Cyrillic harflar (diagramma yorliqlari), ° (gradus), №
ALLOWED_NONASCII = set("°№")
def is_cyr(ch): return "CYRILLIC" in (unicodedata.name(ch, ""))
bad_chars=collections.Counter()
for q in Q:
    blob = q["question"]+" "+(q["description"] or "")+" "+" ".join(o["text"] for o in q["options"])
    for ch in blob:
        if ord(ch)>127 and ch not in ALLOWED_NONASCII and not is_cyr(ch):
            bad_chars[ch]+=1
print("4) orfografiya ASCII (ruxsatsiz belgi):", "OK" if not bad_chars else f"FAIL {dict(bad_chars)}")
if bad_chars: errors.append("orthography")
# qancha apostrof/qoshtirnoq standartlashtirilgani — ASCII ' va " soni
ap=sum((q["question"]+(q['description'] or '')).count("'") for q in Q)
print("   ASCII apostrof ' soni:", ap, "| fancy apostrof qoldiq:",
      sum(bad_chars[c] for c in bad_chars if unicodedata.category(c).startswith('P')))

# 5) RASMLAR: hammasi webp, mavjud, orphan yo'q, ochiladi
refs=[q["imageUrl"] for q in Q if q.get("imageUrl")]
non_webp=[r for r in refs if not r.lower().endswith(".webp")]
disk=set(os.listdir(os.path.join(OUT,"images")))
non_webp_disk=[f for f in disk if not f.lower().endswith(".webp")]
miss=[r for r in refs if r.split("/")[-1] not in disk]
orph=disk-{r.split("/")[-1] for r in refs}
print(f"5) rasm: jami_ref={len(refs)} non_webp_ref={len(non_webp)} "
      f"non_webp_disk={len(non_webp_disk)} missing={len(miss)} orphan={len(orph)}",
      "->", "OK" if not(non_webp or non_webp_disk or miss or orph) else "FAIL")
if non_webp or non_webp_disk or miss or orph: errors.append("images")
# ochilishini sinash (3 ta namuna + avval jpg bo'lgani)
try:
    for f in list(disk)[:3]+[f for f in disk if f.startswith("extra")][:2]:
        Image.open(os.path.join(OUT,"images",f)).verify()
    print("   namuna rasmlar ochildi: OK")
except Exception as e:
    print("   rasm ochishda xato:", e); errors.append("img-open")

# 6) DUBLIKAT yo'qligini qayta tekshir (matn+javob+rasm-hash)
APOS="'`"
def nrm(s):
    s=unicodedata.normalize("NFKD",s or "").lower()
    s="".join(c for c in s if c not in APOS and not unicodedata.combining(c))
    return re.sub(r"[^0-9a-zа-я]+","",s)
def ih(rel):
    if not rel: return None
    p=os.path.join(OUT,rel.replace("/",os.sep))
    return hashlib.md5(open(p,"rb").read()).hexdigest() if os.path.isfile(p) else "X"
seen=collections.defaultdict(list)
for q in Q:
    ak="|".join(sorted(nrm(o["text"]) for o in q["options"]))
    ca=nrm(next(o["text"] for o in q["options"] if o["key"]==q["answer"][0]))
    seen[(nrm(q["question"]),ak,str(ih(q.get("imageUrl"))),ca)].append(q["id"])
dups=[v for v in seen.values() if len(v)>1]
print("6) dublikat guruh:", len(dups), "->", "OK" if not dups else f"FAIL {dups[:3]}")
if dups: errors.append("dup")

# 7) STATS
print("\n--- STATS ---")
print("biletlar:", len({q["ticket_number"] for q in Q}),
      "| izohli:", sum(1 for q in Q if q["description"]),
      "| rasmli:", len(refs))
sz=sum(os.path.getsize(os.path.join(OUT,"images",f)) for f in disk)
print(f"rasm: {len(disk)} ta, {sz/1048576:.1f} MB")
print("\n=== NATIJA:", "BARCHA TEKSHIRUV O'TDI ✅" if not errors else f"XATO: {errors}",
      "| ogohlantirish:", warns or "yo'q")
