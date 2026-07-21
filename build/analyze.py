# -*- coding: utf-8 -*-
import json, re, unicodedata, collections, os

SRC = os.path.join(os.path.dirname(__file__), "_src")

with open(os.path.join(SRC, "pravaol", "questions.json"), encoding="utf-8") as f:
    prav = json.load(f)
with open(os.path.join(SRC, "avtotest", "avto-test-1000-savol.json"), encoding="utf-8") as f:
    avto = json.load(f)["questions"]

APOS = "'’`ʻʼ‘´ʻʼʹ’‘"
def norm(s):
    if not s: return ""
    s = unicodedata.normalize("NFKD", s)
    s = s.lower()
    s = re.sub(r"^\s*savol\s*-?\s*\d+\s*[:.\-]?\s*", "", s)  # strip "Savol-1:" prefix
    # remove apostrophe-like marks so o'/oʻ, g'/gʻ, ta'sir/taʼsir unify
    s = "".join(ch for ch in s if ch not in APOS)
    # drop combining marks
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    # keep only alphanumerics (handles « » " " punctuation/spacing diffs)
    s = re.sub(r"[^0-9a-zа-я]+", "", s)
    return s

def ans_key(answers):
    return "|".join(sorted(norm(a) for a in answers))

# ---- duplicates inside pravaol ----
by_text = collections.defaultdict(list)
by_text_ans = collections.defaultdict(list)
for q in prav:
    by_text[norm(q["text"])].append(q["id"])
    by_text_ans[(norm(q["text"]), ans_key(q["answers"]))].append(q["id"])

dup_text = {k:v for k,v in by_text.items() if k and len(v) > 1}
dup_full = {k:v for k,v in by_text_ans.items() if k[0] and len(v) > 1}

print("PRAVAOL questions:", len(prav))
print("Duplicate by TEXT only:", len(dup_text), "groups,",
      sum(len(v) for v in dup_text.values()), "questions involved")
print("Duplicate by TEXT+ANSWERS (true dup):", len(dup_full), "groups,",
      sum(len(v) for v in dup_full.values()), "questions involved")
for k,v in list(dup_full.items())[:8]:
    print("   true-dup ids:", v)
# show a few text-only (same question, maybe different answers/options)
shown=0
for k,v in dup_text.items():
    if (k, ) not in [(kk[0],) for kk in dup_full]:
        pass
print()

# ---- matching pravaol <- avtotest descriptions ----
avto_by_text = {}
avto_by_full = {}
for q in avto:
    t = norm(q["question"])
    avto_by_text.setdefault(t, q)
    a = ans_key([o["text"] for o in q["options"]])
    avto_by_full.setdefault((t, a), q)

m_full = m_text = 0
unmatched = []
for q in prav:
    t = norm(q["text"]); a = ans_key(q["answers"])
    if (t, a) in avto_by_full:
        m_full += 1
    elif t in avto_by_text:
        m_text += 1
    else:
        unmatched.append(q["id"])

print("MATCHING pravaol <- avtotest:")
print("  matched by text+answers:", m_full)
print("  matched by text only    :", m_text)
print("  total matched           :", m_full + m_text, "/", len(prav))
print("  NOT matched (no desc)   :", len(unmatched))

# avtotest questions not present in pravaol
prav_text = set(norm(q["text"]) for q in prav)
avto_not_in_prav = [q["id"] for q in avto if norm(q["question"]) not in prav_text]
print("  avtotest Qs NOT found in pravaol:", len(avto_not_in_prav))
