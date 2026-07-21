"""questions_3lang.json dagi savollarni biletlarga taqsimlaydi (random, 20 tadan).

- 1224 savol -> 61 bilet x 20 + 62-bilet x 4 (qoldiq). Bilet a'zoligi DOIMIY.
- Savol massivining tartibi o'zgarmaydi, faqat har savolga `ticket_number` qo'shiladi.
- Tartib (savollarning biletga taqsimlanishi) tasodifiy.
"""
import json, os, random
from collections import Counter

SEED = r"C:\Users\Nurbek\OneDrive\Desktop\Prava pro\backend\seed_3lang\questions_3lang.json"
SIZE = 20

data = json.load(open(SEED, encoding="utf-8"))
qs = data["questions"]
n = len(qs)
full = n // SIZE          # to'liq biletlar soni (61)
rem = n % SIZE            # qoldiq (4)

assign = []
for t in range(1, full + 1):
    assign += [t] * SIZE
if rem:
    assign += [full + 1] * rem   # 62-bilet (qoldiq)
random.shuffle(assign)           # tasodifiy taqsimot

for q, t in zip(qs, assign):
    q["ticket_number"] = t

data["meta"]["tickets"] = full + (1 if rem else 0)
data["meta"]["ticket_size"] = SIZE
json.dump(data, open(SEED, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

c = Counter(q["ticket_number"] for q in qs)
full20 = sum(1 for v in c.values() if v == SIZE)
odd = {k: v for k, v in c.items() if v != SIZE}
print(f"Jami savol: {n}")
print(f"Biletlar  : {len(c)}  ({full20} ta to'liq 20 lik" + (f", qoldiq bilet {odd})" if odd else ")"))
print("Namuna    : 1-bilet=%d savol, %d-bilet=%d savol" % (c[1], len(c), c[len(c)]))
