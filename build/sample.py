# -*- coding: utf-8 -*-
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prava-pro-1224")
Q = json.load(open(os.path.join(OUT, "questions.json"), encoding="utf-8"))["questions"]
print("--- Namuna (oldin «...» va o + U+02BB bor edi, endi ASCII) ---")
print(json.dumps(Q[1], ensure_ascii=False, indent=2))
print("\n--- jpg edi -> endi webp ---")
ex = [q for q in Q if (q.get("imageUrl") or "").startswith("images/extra")]
print(json.dumps(ex[0], ensure_ascii=False, indent=2) if ex else "yo'q")
