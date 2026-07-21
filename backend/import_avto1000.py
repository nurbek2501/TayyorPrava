"""avto-test-1000 (avto-test-yangi.uz) bazasini 42 mavzuga taqsimlab import.

Mavzular o'zgarmaydi (bo'sh 42 ta mavzu mavjud). Har savol turiga qarab
biriktiriladi: (1) eski-baza zaxirasiga matn mosligi, (2) description'dagi
belgi guruhi (X.YY -> belgi mavzusi), (3) razmetka, (4) kalit so'z, (5) default.

Tillar: uz (lotin, manbadan), kaa (kirill, transliteratsiya), ru (bo'sh).
Tushuntirish (description) ham uz+kaa saqlanadi. Rasm -> /static/<imageUrl>.
"""
from __future__ import annotations

import asyncio
import glob
import json
import re
import sys
from collections import Counter
from pathlib import Path

from sqlalchemy import func, select

from app.db.session import AsyncSessionLocal
from app.models.enums import Lang
from app.models.question import Option, OptionTranslation, Question, QuestionTranslation
from app.models.topic import Topic
from import_questions import to_cyrillic  # lotin -> kirill


def strip_prefix(s: str) -> str:
    return re.sub(r"^\s*savol\s*[-\s]*\d+\s*[:.\-]\s*", "", s or "", flags=re.I).strip()


def _norm(s: str) -> str:
    s = re.sub(r"^\s*savol[-\s]*\d+\s*[:.]\s*", "", (s or ""), flags=re.I)
    s = re.sub(r"[^a-zа-яё0-9 ]", " ", s.lower()).replace("x", "h")
    return re.sub(r"\s+", " ", s).strip()


# Belgi guruhi (sign number birinchi raqami) -> mavzu id.
_SIGN = {1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 7, 7: 8, 8: 9}

# Kalit so'z -> mavzu (tartib muhim: aniqrog'i oldinda).
_KW: list[tuple[int, list[str]]] = [
    (36, ["tibbiy yordam", "jarohat", "umurtqa", "qon ket", "jabrlanuvchi", "birinchi yordam", "shikastlanganda", "bemor", "kuyish", "suniy nafas"]),
    (11, ["svetofor"]),
    (12, ["tartibga soluvchi", "nizomchi", "regulirov"]),
    (21, ["temir yo", "shlagbaum", "temiryo"]),
    (20, ["piyoda"]),
    (19, ["chorraha", "chorrax", "kesishma"]),
    (22, ["avtomagistral"]),
    (23, ["turar joy", "yashash zona", "hovli"]),
    (26, ["velosiped", "moped", "mototsikl"]),
    (29, ["shatak"]),
    (40, ["sug'urta", "sugurta", "osago"]),
    (33, ["guvohnoma"]),
    (24, ["yo'lovchi", "yolovchi", "yo'lovchilar"]),
    (25, ["yuk tashish", "yukni", "yuklarni", "gabarit"]),
    (17, ["quvib o", "o'zib o", "ozib o", "qarama-qarshi"]),
    (18, ["to'xtash", "to'xtab turish", "toxtash", "to'xtashga"]),
    (16, ["tezlik", "tezlikda", "km/soat"]),
    (14, ["manevr", "burilish", "qayrilish", "orqaga yurish", "joyidan jilish", "harakatni boshlash"]),
    (27, ["far", "yoritish", "yoruglik", "yorug'lik", "gabarit chiroq", "yaqin yoritish", "uzoq yoritish"]),
    (28, ["shoshilinch", "tezkor", "maxsus signal", "ko'k chiroq", "tezyordam", "operativ"]),
    (30, ["o'quv haydash", "oquv haydash", "instruktor", "o'rgatuvchi"]),
    (31, ["nosozlik", "texnik holat", "ekspluatatsiya", "tormoz tizimi nosoz", "rul boshqaruvi"]),
    (32, ["toifa", "turkum", "kategoriya"]),
    (38, ["ekologik", "atrof-muhit", "tutun", "zaharli", "is gazi"]),
    (39, ["javobgarlik", "jarima", "jazo", "ma'muriy"]),
    (35, ["yo'l-transport hodisa", "yol-transport hodisa", "halokat", "to'qnashuv", "yth"]),
    (41, ["ekstremal", "muzli", "sirpanchiq", "tuman", "yomg'ir", "qor yog", "toyganda"]),
    (42, ["psixologiya", "charchoq", "stress", "hissiyot", "uyqu"]),
    (13, ["tovush signali", "signal berib", "favqulodda to'xtash belgisi", "favqulodda to'xtatish"]),
    (15, ["qatnov qismida joylash", "yo'lda joylashish", "qatorlab"]),
    (10, ["razmetka"]),
    (2, ["majburiyat", "haydovchi shart", "hujjatlar"]),
    (34, ["xavfsizlik"]),
    (1, ["atama", "ta'rif", "tarif", "tushuncha", "deganda nima", "termin"]),
]


def classify(q: dict, old_map: dict[str, int]) -> int:
    n = _norm(q.get("question", ""))
    if n in old_map:
        return old_map[n]
    text = (q.get("question") or "")
    desc = (q.get("description") or "")
    full = (text + " " + desc).lower()
    dl = desc.lower()

    # Razmetka (chiziqlar) — belgidan oldin tekshiramiz.
    if "razmetka" in full or ("chiziq" in dl and "ilova" in dl):
        return 10
    # Yo'l belgisi guruhi: description'da "belgi" + X.YY raqami.
    if "belgi" in dl:
        m = re.search(r"\b([1-8])\.\d", dl)
        if m and int(m.group(1)) in _SIGN:
            return _SIGN[int(m.group(1))]
    # Kalit so'z bo'yicha.
    for tid, words in _KW:
        if any(w in full for w in words):
            return tid
    # Umumiy belgi savoli (raqamsiz) -> ogohlantiruvchi.
    if "belgi" in full:
        return 3
    return 1  # Umumiy qoidalar


def _expl(uz_text: str) -> tuple[str | None, str | None]:
    uz_text = (uz_text or "").strip()
    if not uz_text:
        return None, None
    return uz_text, to_cyrillic(uz_text)


async def run(json_path: Path) -> None:
    qs = json.loads(json_path.read_text(encoding="utf-8"))["questions"]

    # Eski zaxiradan matn->mavzu (faqat mavzu merosini olish uchun).
    old_map: dict[str, int] = {}
    baks = sorted(glob.glob("app.db.bak-before-empty-*"))
    if baks:
        import sqlite3
        c = sqlite3.connect(baks[-1])
        for t, tid in c.execute(
            "select qt.text,q.topic_id from question_translations qt "
            "join questions q on q.id=qt.question_id where qt.lang='uz'"
        ).fetchall():
            old_map.setdefault(_norm(t), tid)
        c.close()

    plan = [classify(q, old_map) for q in qs]

    async with AsyncSessionLocal() as db:
        valid = {tid for (tid,) in (await db.execute(select(Topic.id))).all()}
        # Bo'sh bazaga import (savollar allaqachon o'chirilgan); ehtiyot uchun tozalaymiz.
        from sqlalchemy import delete
        await db.execute(delete(Question).execution_options(synchronize_session=False))
        await db.flush()

        method = Counter()
        added = with_image = 0
        for q, topic_id in zip(qs, plan):
            if topic_id not in valid:
                topic_id = 1
            qtext = strip_prefix(q.get("question") or "")
            if not qtext:
                continue
            method[topic_id] += 1
            rasm = q.get("imageUrl")
            image_url = f"/static/{rasm}" if rasm else None
            if image_url:
                with_image += 1
            euz, ekaa = _expl(q.get("description"))

            question = Question(
                topic_id=topic_id,
                image_url=image_url,
                order_index=int(q.get("id") or 0),
                ticket_number=0,
            )
            db.add(question)
            await db.flush()

            db.add(QuestionTranslation(
                question_id=question.id, lang=Lang("uz"), text=qtext, explanation=euz))
            db.add(QuestionTranslation(
                question_id=question.id, lang=Lang("kaa"),
                text=to_cyrillic(qtext), explanation=ekaa))
            db.add(QuestionTranslation(
                question_id=question.id, lang=Lang("ru"), text="", explanation=None))

            answers = set(q.get("answer") or [])
            for i, ov in enumerate(q.get("options") or []):
                matn = (ov.get("text") or "").strip()
                opt = Option(
                    question_id=question.id,
                    is_correct=ov.get("key") in answers,
                    order_index=i,
                )
                db.add(opt)
                await db.flush()
                db.add(OptionTranslation(option_id=opt.id, lang=Lang("uz"), text=matn))
                db.add(OptionTranslation(
                    option_id=opt.id, lang=Lang("kaa"), text=to_cyrillic(matn)))
                db.add(OptionTranslation(option_id=opt.id, lang=Lang("ru"), text=""))
            added += 1

        await db.commit()
        total = (await db.execute(select(func.count()).select_from(Question))).scalar_one()
        print(f"Import: {added} savol ({with_image} rasmli)")
        print(f"Bazada: {total} savol")
        print("Mavzu taqsimoti (id: soni):", dict(sorted(method.items())))


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Foydalanish: python import_avto1000.py <json>")
    p = Path(sys.argv[1])
    if not p.exists():
        sys.exit(f"Fayl topilmadi: {p}")
    asyncio.run(run(p))


if __name__ == "__main__":
    main()
