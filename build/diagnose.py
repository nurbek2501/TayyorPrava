# -*- coding: utf-8 -*-
import json, re, unicodedata, collections, os, difflib

SRC = os.path.join(os.path.dirname(__file__), "_src")
with open(os.path.join(SRC, "pravaol", "questions.json"), encoding="utf-8") as f:
    prav = json.load(f)
with open(os.path.join(SRC, "avtotest", "avto-test-1000-savol.json"), encoding="utf-8") as f:
    avto = json.load(f)["questions"]

APOS = "'’`ʻʼ‘´ʹ"
def norm(s):
    if not s: return ""
    s = unicodedata.normalize("NFKD", s).lower()
    s = re.sub(r"^\s*savol\s*-?\s*\d+\s*[:.\-]?\s*", "", s)
    s = "".join(ch for ch in s if ch not in APOS and not unicodedata.combining(ch))
    s = re.sub(r"[^0-9a-zа-я]+", "", s)
    return s

def tokens(s):
    if not s: return set()
    s = unicodedata.normalize("NFKD", s).lower()
    s = re.sub(r"^\s*savol\s*-?\s*\d+\s*[:.\-]?\s*", "", s)
    s = "".join(ch for ch in s if ch not in APOS and not unicodedata.combining(ch))
    return set(w for w in re.split(r"[^0-9a-zа-я]+", s) if len(w) > 2)

pid = {q["id"]: q for q in prav}

# 1) Inspect TEXT-only duplicate groups: are images/answers/correct different?
by_text = collections.defaultdict(list)
for q in prav:
    by_text[norm(q["text"])].append(q["id"])
text_groups = {k:v for k,v in by_text.items() if k and len(v) > 1}

same_all = diff_img = diff_ans = diff_corr = 0
examples_diff_img = []
for k, ids in text_groups.items():
    qs = [pid[i] for i in ids]
    imgs = set(q["image"] for q in qs)
    anss = set(tuple(q["answers"]) for q in qs)
    corrs = set(q["correct_index"] for q in qs)
    if len(imgs) > 1: diff_img += 1; examples_diff_img.append(ids)
    if len(anss) > 1: diff_ans += 1
    if len(anss) == 1 and len(imgs) == 1 and len(corrs) == 1: same_all += 1
    elif len(anss) == 1 and len(corrs) > 1: diff_corr += 1

print("TEXT-only duplicate groups:", len(text_groups))
print("  -> identical text+answers+image+correct (TRUE dup):", same_all)
print("  -> same text but DIFFERENT image (distinct Qs):", diff_img)
print("  -> same text+answers but DIFFERENT correct_index (CONFLICT):", diff_corr)
print("  examples different-image groups:", examples_diff_img[:6])
print()

# 2) Improve matching: token Jaccard + answer overlap
def ans_tokens(answers):
    return [norm(a) for a in answers]

avto_norm = []
for q in avto:
    avto_norm.append({
        "q": q,
        "t": norm(q["question"]),
        "tok": tokens(q["question"]),
        "ans": set(norm(o["text"]) for o in q["options"]),
    })
avto_by_text = {}
for a in avto_norm:
    avto_by_text.setdefault(a["t"], a)

def best_match(q):
    t = norm(q["text"])
    if t in avto_by_text:
        return avto_by_text[t], 1.0, "exact"
    qt = tokens(q["text"]); qa = set(norm(x) for x in q["answers"])
    if not qt: return None, 0, "none"
    best=None; bestsc=0
    for a in avto_norm:
        if not a["tok"]: continue
        j = len(qt & a["tok"]) / len(qt | a["tok"])
        if j > bestsc:
            bestsc=j; best=a
    # boost confidence if answers overlap
    if best:
        ao = len(qa & best["ans"]) / max(1,len(qa))
        return best, bestsc, f"jac={bestsc:.2f},ansov={ao:.2f}"
    return None,0,"none"

buckets = collections.Counter()
matched_desc = 0
examples = []
for q in prav:
    m, sc, info = best_match(q)
    if sc >= 0.999:
        buckets["exact"] += 1; matched_desc += 1
    elif sc >= 0.85:
        buckets["fuzzy>=.85"] += 1; matched_desc += 1
        if len(examples) < 5: examples.append((q["text"][:50], m["q"]["question"][:50], info))
    elif sc >= 0.70:
        buckets["fuzzy.70-.85"] += 1
        if len(examples) < 10: examples.append((q["text"][:50], m["q"]["question"][:50], info))
    else:
        buckets["weak<.70"] += 1

print("MATCH buckets:", dict(buckets))
print("Description coverage if accept >=0.85:", matched_desc, "/", len(prav))
print("Sample fuzzy matches:")
for a,b,info in examples[:8]:
    print("   P:", a)
    print("   A:", b, "|", info)
