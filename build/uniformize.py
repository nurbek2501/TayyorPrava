# -*- coding: utf-8 -*-
"""
Birlashtirilgan bazani YAGONA BIR XIL ko'rinishga keltiradi:
  - orfografiya -> ASCII (o'  g'  '  "  -)  [ilovaning _norm_apos konvensiyasi]
  - barcha rasmlar -> .webp
  - sxema -> ilovaning import formati (import_avto1000.py o'qiydi):
      {source, language, total, questions:[
         {id, ticket_number, multiChoose, question, imageUrl,
          options:[{key,text}], answer:[key], correct_answer, description}]}
"""
import json, os, re, sys, shutil
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image

BASE = os.path.dirname(os.path.dirname(__file__))
OUT  = os.path.join(BASE, "prava-pro-1224")
IMG  = os.path.join(OUT, "images")
SRC_JSON = os.path.join(OUT, "questions.json")

Q = json.load(open(SRC_JSON, encoding="utf-8"))

# ---- orfografiya normalizatsiyasi (ASCII) ----
SINGLE = "ʻʼ‘’`´ʹ′"   # -> '
DOUBLE = "«»“”„″ʺ"        # -> "
DASH   = "–—‒−"                          # -> -
def na(s):
    if not s: return s
    o = []
    for ch in s:
        if   ch in SINGLE: o.append("'")
        elif ch in DOUBLE: o.append('"')
        elif ch in DASH:   o.append("-")
        elif ch == " ": o.append(" ")
        else: o.append(ch)
    return re.sub(r" {2,}", " ", "".join(o)).strip()

# ---- rasmlarni webp ga o'tkazish ----
converted = 0
img_rename = {}   # eski nisbiy yo'l -> yangi nisbiy yo'l
for fn in list(os.listdir(IMG)):
    ext = os.path.splitext(fn)[1].lower()
    if ext == ".webp": continue
    src = os.path.join(IMG, fn)
    newfn = os.path.splitext(fn)[0] + ".webp"
    try:
        im = Image.open(src)
        if im.mode in ("RGBA", "P"): im = im.convert("RGB")
        im.save(os.path.join(IMG, newfn), "WEBP", quality=88, method=6)
        os.remove(src)
        img_rename[f"images/{fn}"] = f"images/{newfn}"
        converted += 1
    except Exception as e:
        print("  ! rasm xato:", fn, e)
print(f"rasm webp ga o'tkazildi : {converted}")

# ---- sxema transformatsiyasi ----
out_questions = []
for q in Q:
    img = q.get("image")
    if img in img_rename: img = img_rename[img]
    answers = q["answers"]; ci = q["correct_index"]
    options = [{"key": f"F{i+1}", "text": na(a)} for i, a in enumerate(answers)]
    correct = f"F{ci+1}"
    out_questions.append({
        "id": q["id"],
        "ticket_number": q.get("ticket_id"),
        "multiChoose": False,
        "question": na(q["text"]),
        "imageUrl": img,
        "options": options,
        "answer": [correct],
        "correct_answer": correct,
        "description": na(q.get("description") or ""),
    })

doc = {
    "source": "Prava Pro — pravaol_savollar_1224 + avto-test-1000 (birlashtirilgan, bir xil)",
    "language": "UZ",
    "total": len(out_questions),
    "note": "Orfografiya ASCII (o' g' ' \" -); barcha rasm webp; "
            "import_avto1000.py bilan to'g'ridan-to'g'ri import qilinadi.",
    "questions": out_questions,
}
json.dump(doc, open(SRC_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# meta + README yangilash
json.dump({
    "title": "Prava Pro — yagona bir xil test bazasi",
    "total": len(out_questions),
    "tickets": len({q["ticket_number"] for q in out_questions}),
    "with_description": sum(1 for q in out_questions if q["description"]),
    "with_image": sum(1 for q in out_questions if q["imageUrl"]),
    "orthography": "ASCII (o' g' ' \" -)",
    "image_format": "webp (100%)",
    "schema": "import_avto1000.py mos: questions[].{id,ticket_number,question,imageUrl,options[{key,text}],answer[],description}",
}, open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

readme = """PRAVA PRO — YAGONA BIR XIL TEST BAZASI
=======================================
Savollar     : {n}
Biletlar     : 1-61 (asl) + 62 "Qo'shimcha" (yangi savollar)
Izohli savol : {d}
Rasmli savol : {im}  (barchasi .webp)
Orfografiya  : ASCII  ->  o'  g'  '  "  -   (bir xil)

TUZILMA
  questions.json   - {n} savol (ilova import formati)
  images/          - .webp rasmlar
  meta.json        - meta ma'lumot

SAVOL FORMATI
  {{
    "id": 1, "ticket_number": 1, "multiChoose": false,
    "question": "...", "imageUrl": "images/question_1.webp",
    "options": [{{"key":"F1","text":"..."}}, ...],
    "answer": ["F4"], "correct_answer": "F4",
    "description": "YHQ ..."
  }}

ILOVAGA IMPORT (backend/)
  python import_avto1000.py <shu_papka>/questions.json
  (description -> explanation; uz lotin, kaa kirill avto-transliteratsiya)
""".format(n=len(out_questions),
           d=sum(1 for q in out_questions if q["description"]),
           im=sum(1 for q in out_questions if q["imageUrl"]))
open(os.path.join(OUT, "README.txt"), "w", encoding="utf-8").write(readme)

# eski MERGE_REPORT saqlanadi
print(f"questions.json yangilandi: {len(out_questions)} savol")
print("OK")
