# -*- coding: utf-8 -*-
"""
uz.json (o'zbek lotin) -> ru.json (rus tili)

Bu skript SAVOLLAR TUZILMASINI BUZMAYDI:
  - id, ticket_id, ticket_sort, topic_ids, image, correct_index  -> TEGILMAYDI (nusxa olinadi)
  - faqat text, answers, mavzu nomlari tarjima qilinadi
  - correct_answer HAR DOIM answers[correct_index] dan qayta olinadi
    => to'g'ri javob ko'rsatkichi hech qachon adashmaydi

Ishlash tartibi:
  1) Noyob satrlar yig'iladi (takrorlar bir marta tarjima qilinadi -> tejam + izchillik)
  2) Ular partiyalab (batch) tarjima qilinadi
  3) Tarjimalar diskka keshlanadi (translations_cache_ru.json) -> uzilib qolsa davom etadi
  4) ru.json qayta quriladi va integrity tekshiruvidan o'tkaziladi

Talab:  pip install anthropic
Kalit:  export ANTHROPIC_API_KEY=sk-ant-...
Ishga:  python translate_to_ru.py
"""

import json
import os
import sys
import copy
import time

# ============ SOZLAMALAR ============
SRC_FILE   = "uz.json"
OUT_FILE   = "ru.json"
CACHE_FILE = "translations_cache_ru.json"
BATCH_SIZE = 40                       # bitta so'rovda nechta satr
MODEL      = "claude-sonnet-5"        # istalgan joriy modelni qo'yish mumkin
# =====================================

SYSTEM_PROMPT = (
    "Siz professional tarjimonsiz. Sizga O'zbekiston yo'l harakati qoidalari "
    "(YHQ / haydovchilik guvohnomasi) test savollari va javob variantlari o'zbek "
    "tilida beriladi. Ularni ANIQ va tabiiy rus tiliga tarjima qiling.\n"
    "QAT'IY QOIDALAR:\n"
    "1. Sizga JSON massiv (array) ko'rinishida satrlar beriladi. Faqat shu satrlarni "
    "tarjima qiling.\n"
    "2. Javobingiz FAQAT JSON massiv bo'lsin: kirish bilan bir xil uzunlik, bir xil "
    "tartib. Hech qanday izoh, sarlavha yoki ```json``` belgisi qo'shmang.\n"
    "3. Sof raqamlar (1, 2, 3), harflar (A, B) yoki belgi kodlari o'zgarmasin.\n"
    "4. O'lchov birliklari to'g'ri berilsin: 'km/s' (km/soat) -> 'км/ч', 'm' -> 'м'.\n"
    "5. Atamalar YHQ (ПДД) rasmiy uslubida bo'lsin: masalan 'Taqiqlanadi' -> "
    "'Запрещается', 'Ruxsat etiladi' -> 'Разрешается'."
)


def translate_batch(strings):
    """Bitta partiyani rus tiliga tarjima qiladi. FAQAT shu funksiyani
    almashtirsangiz boshqa xizmatga (Google/Yandex) o'tishingiz mumkin."""
    import anthropic
    client = anthropic.Anthropic()  # ANTHROPIC_API_KEY muhit o'zgaruvchisidan olinadi
    payload = json.dumps(strings, ensure_ascii=False)
    for attempt in range(5):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=8000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": payload}],
            )
            text = "".join(b.text for b in resp.content if b.type == "text").strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.lstrip().lower().startswith("json"):
                    text = text.lstrip()[4:]
            out = json.loads(text)
            if not isinstance(out, list) or len(out) != len(strings):
                raise ValueError("uzunlik mos kelmadi: %d != %d" % (len(out), len(strings)))
            return [str(x) for x in out]
        except Exception as e:
            print("    urinish %d xato: %s" % (attempt + 1, e))
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("partiya tarjima qilinmadi (5 urinishdan keyin)")


def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def main():
    with open(SRC_FILE, encoding="utf-8") as f:
        src = json.load(f)

    # --- 1) noyob satrlarni yig'ish (correct_answer ni EMAS -> u qayta olinadi)
    uniq = set()
    for t in src["topics"]:
        if t.get("name"):
            uniq.add(t["name"])
    for q in src["questions"]:
        if q.get("text"):
            uniq.add(q["text"])
        for a in q.get("answers", []):
            uniq.add(a)
        for tn in q.get("topics", []):
            uniq.add(tn)
    uniq = sorted(uniq)
    print("Noyob satrlar:", len(uniq))

    # --- 2) keshdan foydalanib, qolganini partiyalab tarjima qilish
    cache = load_cache()
    todo = [s for s in uniq if s not in cache]
    print("Tarjima qilinadi:", len(todo), "(keshda bor:", len(uniq) - len(todo), ")")

    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i:i + BATCH_SIZE]
        print("Partiya %d..%d / %d" % (i + 1, i + len(batch), len(todo)))
        translated = translate_batch(batch)
        for s, r in zip(batch, translated):
            cache[s] = r
        save_cache(cache)  # har partiyadan keyin saqlaymiz (uzilsa davom etadi)

    tr = lambda x: cache.get(x, x) if isinstance(x, str) else x

    # --- 3) ru.json ni qayta qurish (tuzilma nusxa olinadi)
    out = copy.deepcopy(src)
    out["language"] = "ru"
    for t in out["topics"]:
        t["name"] = tr(t["name"])
    for q in out["questions"]:
        q["text"] = tr(q.get("text"))
        q["answers"] = [tr(a) for a in q.get("answers", [])]
        q["topics"] = [tr(tn) for tn in q.get("topics", [])]
        # KAFOLAT: to'g'ri javob har doim indeks bo'yicha qayta olinadi
        ci = q["correct_index"]
        q["correct_answer"] = q["answers"][ci]
        # id, ticket_id, ticket_sort, topic_ids, image, correct_index -> tegilmadi

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("Yozildi:", OUT_FILE)

    # --- 4) integrity tekshiruvi
    problems = 0
    for a, b in zip(src["questions"], out["questions"]):
        for k in ("id", "ticket_id", "ticket_sort", "topic_ids", "image", "correct_index"):
            if a.get(k) != b.get(k):
                problems += 1
                print("  MISMATCH id=%s field=%s" % (a["id"], k))
        if len(a["answers"]) != len(b["answers"]):
            problems += 1
            print("  answers soni mos emas id=%s" % a["id"])
        ci = b["correct_index"]
        if not (0 <= ci < len(b["answers"])) or b["answers"][ci] != b["correct_answer"]:
            problems += 1
            print("  correct_answer buzilgan id=%s" % a["id"])
    print("INTEGRITY muammolari:", problems)
    if problems == 0:
        print("OK — barcha savollar tuzilishi saqlangan.")


if __name__ == "__main__":
    if not os.path.exists(SRC_FILE):
        sys.exit("Xato: %s topilmadi (skriptni uz.json yonida ishga tushiring)." % SRC_FILE)
    main()
