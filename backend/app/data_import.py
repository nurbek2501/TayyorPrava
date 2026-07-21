"""Import the 3-language PDD dataset (pdd_1224.json) into the database.

Manba: `Test baza` (pravaol.uz) — 44 mavzu, 1224 savol, 3 tilda:
  uz  -> O'zbekcha (lotin)      -> Lang.uz  slot
  kaa -> Ўзбекча (kirill)       -> Lang.kaa slot
  ru  -> Русский                -> Lang.ru  slot

Har savol o'z `topic_id`, `ticket`, `order` va (bo'lsa) rasmiga ega. Rasmsiz
savollarda `image = None` — frontend avtomatik `no-image-car.webp` (qora mashina)
placeholder'ini ko'rsatadi. Rasmli savollarning rasmi `app/data/question_images/`
dan `UPLOAD_DIR` ga ko'chiriladi va `/static/<fayl>` sifatida beriladi.
"""
from __future__ import annotations

import json
import os
import shutil
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import Lang
from app.models.question import (
    Option,
    OptionTranslation,
    Question,
    QuestionTranslation,
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "pdd_1224.json")
IMAGE_SRC_DIR = os.path.join(os.path.dirname(__file__), "data", "question_images")


def load_data() -> dict:
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def topics() -> list[dict]:
    """44 mavzu (id, name_uz, name_kaa, name_ru) — seed_topics uchun."""
    return load_data()["topics"]


def _copy_image(filename: str) -> str | None:
    """Rasmni UPLOAD_DIR ga ko'chiradi (bo'lmasa) va /static URL qaytaradi."""
    src = os.path.join(IMAGE_SRC_DIR, filename)
    if not os.path.exists(src):
        return None
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    dst = os.path.join(settings.UPLOAD_DIR, filename)
    if not os.path.exists(dst):
        shutil.copyfile(src, dst)
    return f"/static/{filename}"


async def import_questions(db: AsyncSession) -> int:
    """Barcha savol/variant/tarjimalarni yaratadi. Commit chaqiruvchida."""
    data = load_data()
    questions = data["questions"]

    for i, q in enumerate(questions):
        image_url = _copy_image(q["image"]) if q.get("image") else None
        qid = str(uuid.uuid4())
        db.add(
            Question(
                id=qid,
                topic_id=q["topic_id"],
                ticket_number=q["ticket"],
                order_index=q["order"],
                image_url=image_url,
            )
        )
        txt = q["text"]
        db.add(QuestionTranslation(question_id=qid, lang=Lang.uz, text=txt["uz"]))
        db.add(QuestionTranslation(question_id=qid, lang=Lang.kaa, text=txt["kaa"]))
        db.add(QuestionTranslation(question_id=qid, lang=Lang.ru, text=txt["ru"]))

        for j, opt in enumerate(q["options"]):
            oid = str(uuid.uuid4())
            db.add(
                Option(
                    id=oid,
                    question_id=qid,
                    is_correct=bool(opt["correct"]),
                    order_index=j,
                )
            )
            db.add(OptionTranslation(option_id=oid, lang=Lang.uz, text=opt["uz"]))
            db.add(OptionTranslation(option_id=oid, lang=Lang.kaa, text=opt["kaa"]))
            db.add(OptionTranslation(option_id=oid, lang=Lang.ru, text=opt["ru"]))

        if i % 100 == 99:
            await db.flush()

    await db.flush()
    return len(questions)
