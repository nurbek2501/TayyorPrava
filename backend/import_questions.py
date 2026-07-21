"""rulionline.uz formatidagi JSON savollarni bazaga import qilish.

Foydalanish:
    python import_questions.py <savollar.json> [--topic-id N]

JSON ko'rinishi:
{
  "questions": [
    {
      "id": 1,
      "question": "...savol matni (o'zbek lotin)...",
      "options": [{"key": "F1", "text": "..."}, ...],
      "correct_answer": "F1",
      "topic_id": 36,          # ixtiyoriy — bo'lmasa --topic-id ishlatiladi
      "source": "rulionline.uz"
    }
  ]
}

Savol matni o'zbek lotinida bo'ladi; uz slotiga shu, kaa (kirill) slotiga
avtomatik transliteratsiya yoziladi. ru bo'sh qoldiriladi (interfeysda uz'ga
qaytadi). Bir xil matnli savol allaqachon bo'lsa, o'tkazib yuboriladi.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import delete, func, select

from app.crud import questions as questions_crud
from app.db.session import AsyncSessionLocal
from app.models.question import Question

# ---------------- O'zbek lotin -> kirill transliteratsiya ----------------
_APOS = "'ʻʼ‘’`´"  # turli apostrof variantlari

_DIGRAPHS = [
    ("o'", "ў"),
    ("g'", "ғ"),
    ("ch", "ч"),
    ("sh", "ш"),
    ("yo", "ё"),
    ("yu", "ю"),
    ("ya", "я"),
    ("ye", "е"),
    ("ts", "ц"),
]

_SINGLES = {
    "a": "а", "b": "б", "d": "д", "f": "ф", "g": "г", "h": "ҳ",
    "i": "и", "j": "ж", "k": "к", "l": "л", "m": "м", "n": "н",
    "o": "о", "p": "п", "q": "қ", "r": "р", "s": "с", "t": "т",
    "u": "у", "v": "в", "w": "в", "x": "х", "y": "й", "z": "з",
    "c": "с",
}


def _norm_apos(s: str) -> str:
    for a in _APOS[1:]:
        s = s.replace(a, "'")
    return s


def _apply_case(cyr: str, upper: bool) -> str:
    return cyr.upper() if upper else cyr


def to_cyrillic(text: str) -> str:
    """O'zbek lotin matnini kirillga o'giradi (haydovchilik testi uchun aniq)."""
    s = _norm_apos(text)
    out: list[str] = []
    i, n = 0, len(s)
    while i < n:
        ch = s[i]
        is_upper = ch.isupper()
        pair = s[i : i + 2].lower()

        # «yo'» — bu y + o' (й + ў), «ё» emas.
        if pair == "yo" and s[i + 2 : i + 3] == "'":
            out.append(_apply_case("й", is_upper))
            i += 1
            continue

        matched = False
        for latin, cyr in _DIGRAPHS:
            if pair == latin:
                out.append(_apply_case(cyr, is_upper))
                i += 2
                matched = True
                break
        if matched:
            continue

        low = ch.lower()
        if low == "e":
            prev = s[i - 1] if i > 0 else ""
            word_initial = (i == 0) or (not prev.isalpha() and prev != "'")
            out.append(_apply_case("э" if word_initial else "е", is_upper))
        elif low == "'":
            out.append("ъ")  # tutuq belgisi
        elif low in _SINGLES:
            out.append(_apply_case(_SINGLES[low], is_upper))
        else:
            out.append(ch)  # raqam, tinish belgisi, bo'shliq
        i += 1
    return "".join(out)


# ---------------- Import ----------------
def _localized(latin: str, cyr: str | None = None) -> dict:
    """uz=lotin, kaa=kirill (berilmasa transliteratsiya), ru=bo'sh."""
    return {"uz": latin, "kaa": (cyr.strip() if cyr else to_cyrillic(latin)), "ru": ""}


def _normalize(q: dict) -> tuple[str, dict, list[dict]] | None:
    """JSON savolini (dedup_matni, text_dict, options) ko'rinishiga keltiradi.

    Ikki formatni qo'llaydi:
      • Boy:   {uz_latin:{...}, uz_cyrillic:{...}, kaa:{...}}
      • Sodda: {question, options:[{key,text}], correct_answer}
    """
    if "uz_latin" in q:  # boy format — lotin asosiy, kirill lotindan o'giriladi
        # Izoh: manbadagi uz_cyrillic'da diakritik yo'qolishi (ў→у, ғ→г) bor.
        # uz va kaa bir xil o'zbek matnining ikki yozuvi bo'lishi uchun toza
        # lotindan transliteratsiya qilamiz (izchil va aniqroq).
        lat = q.get("uz_latin") or {}
        qlat = (lat.get("question") or "").strip()
        if not qlat:
            return None
        correct = (lat.get("correct_answer") or "").strip()
        options = []
        for o in lat.get("options", []):
            otext = (o.get("text") or "").strip()
            if not otext:
                continue
            options.append(
                {"text": _localized(otext), "is_correct": o.get("key") == correct}
            )
        return qlat, _localized(qlat), options

    # sodda format — faqat lotin, kirill avto-transliteratsiya
    qtext = (q.get("question") or q.get("text") or "").strip()
    if not qtext:
        return None
    correct = (q.get("correct_answer") or q.get("correct") or "").strip()
    options = []
    for o in q.get("options", []):
        otext = (o.get("text") or "").strip()
        if not otext:
            continue
        options.append({"text": _localized(otext), "is_correct": o.get("key") == correct})
    return qtext, _localized(qtext), options


async def import_file(path: Path, default_topic_id: int, replace: bool) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("questions", data if isinstance(data, list) else [])

    added = skipped = 0
    async with AsyncSessionLocal() as db:
        if replace:
            before = (
                await db.execute(
                    select(func.count())
                    .select_from(Question)
                    .where(Question.topic_id == default_topic_id)
                )
            ).scalar_one()
            await db.execute(
                delete(Question).where(Question.topic_id == default_topic_id)
            )
            print(f"  ⨯ {default_topic_id}-mavzudan {before} ta eski savol o'chirildi")

        for q in items:
            norm = _normalize(q)
            if norm is None:
                print("  ! bo'sh savol — o'tkazildi")
                skipped += 1
                continue
            dedup_text, text_dict, options = norm

            if not options or not any(o["is_correct"] for o in options):
                print(f"  ! to'g'ri javob yo'q — o'tkazildi: {dedup_text[:50]}…")
                skipped += 1
                continue

            # --replace rejimida mavzu tozalangan — global dedup shart emas.
            if not replace and await questions_crud.check_question_exists(db, dedup_text):
                print(f"  = mavjud, o'tkazildi: {dedup_text[:55]}…")
                skipped += 1
                continue

            topic_id = int(q.get("topic_id") or default_topic_id)
            await questions_crud.create_question(
                db,
                topic_id=topic_id,
                text=text_dict,
                explanation=None,
                image_url=q.get("image_url"),
                options=options,
            )
            added += 1
            print(f"  + qo'shildi (topic {topic_id}): {dedup_text[:55]}…")

        await db.commit()

    print(f"\nTayyor: {added} ta qo'shildi, {skipped} ta o'tkazildi.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Savollarni JSON'dan import qilish")
    parser.add_argument("json_path", help="Savollar JSON fayli yo'li")
    parser.add_argument(
        "--topic-id",
        type=int,
        default=36,
        help="topic_id bo'lmagan savollar uchun standart mavzu (default: 36)",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Import oldidan shu mavzudagi BARCHA savollarni o'chirish",
    )
    args = parser.parse_args()

    path = Path(args.json_path)
    if not path.exists():
        sys.exit(f"Fayl topilmadi: {path}")

    asyncio.run(import_file(path, args.topic_id, args.replace))


if __name__ == "__main__":
    main()
