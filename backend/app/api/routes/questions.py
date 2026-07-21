"""Question routes — user practice access + admin CRUD."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.abuse import guard_answer, guard_serve
from app.core.config import settings
from app.core.ratelimit import _client_key, limiter, questions_key
from app.crud import interactions as interactions_crud
from app.crud import questions as questions_crud
from app.crud import topics as topics_crud
from app.db.session import get_db
from app.deps import get_current_admin, get_current_user
from app.models.user import User
from app.schemas.question import (
    CheckAnswerRequest,
    CheckAnswerResponse,
    CheckQuestionRequest,
    CheckQuestionResponse,
    ImageUploadResponse,
    PracticeQuestionRead,
    QuestionCreate,
    QuestionListResponse,
    QuestionRead,
    QuestionUpdate,
    TicketRead,
    TranslateRequest,
    TranslateResponse,
)
from app.services.serializers import (
    correct_option_id,
    question_explanation,
    serialize_practice_question,
    serialize_question,
)
from app.services.translate import translate_many
from app.services.uploads import save_question_image

user_router = APIRouter(tags=["questions"])
admin_router = APIRouter(prefix="/admin/questions", tags=["admin-questions"])


@user_router.get(
    "/topics/{topic_id}/questions", response_model=list[PracticeQuestionRead]
)
@limiter.limit(settings.RATE_LIMIT_QUESTIONS, key_func=questions_key)
@limiter.limit(settings.RATE_LIMIT_QUESTIONS_IP, key_func=_client_key)
async def topic_questions(
    request: Request,
    topic_id: int,
    limit: int = settings.QUESTIONS_PAGE_DEFAULT,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, settings.QUESTIONS_PAGE_MAX))
    offset = max(0, offset)
    questions = await questions_crud.get_questions_by_topic(
        db, topic_id, limit=limit, offset=offset
    )
    await guard_serve(user.id, len(questions))
    return [serialize_practice_question(q) for q in questions]


@user_router.get("/tickets", response_model=list[TicketRead])
async def list_tickets(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    rows = await questions_crud.list_tickets(db)
    return [{"number": n, "count": c} for n, c in rows]


@user_router.get(
    "/tickets/{ticket_number}/questions", response_model=list[PracticeQuestionRead]
)
@limiter.limit(settings.RATE_LIMIT_QUESTIONS, key_func=questions_key)
@limiter.limit(settings.RATE_LIMIT_QUESTIONS_IP, key_func=_client_key)
async def ticket_questions(
    request: Request,
    ticket_number: int,
    limit: int = settings.QUESTIONS_PAGE_DEFAULT,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, settings.QUESTIONS_PAGE_MAX))
    offset = max(0, offset)
    questions = await questions_crud.get_questions_by_ticket(
        db, ticket_number, limit=limit, offset=offset
    )
    await guard_serve(user.id, len(questions))
    return [serialize_practice_question(q) for q in questions]


@user_router.get("/random-questions", response_model=list[PracticeQuestionRead])
@limiter.limit(settings.RATE_LIMIT_QUESTIONS, key_func=questions_key)
@limiter.limit(settings.RATE_LIMIT_QUESTIONS_IP, key_func=_client_key)
async def random_questions(
    request: Request,
    count: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Oraliq nazorat uchun N ta tasodifiy savol (mashq — javoblar yashirin)."""
    count = max(1, min(int(count), settings.QUESTIONS_PAGE_MAX))
    questions = await questions_crud.get_random_questions(db, count)
    await guard_serve(user.id, len(questions))
    return [serialize_practice_question(q) for q in questions]


@user_router.get("/questions/{question_id}", response_model=PracticeQuestionRead)
@limiter.limit(settings.RATE_LIMIT_QUESTIONS, key_func=questions_key)
@limiter.limit(settings.RATE_LIMIT_QUESTIONS_IP, key_func=_client_key)
async def get_question(
    request: Request,
    question_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question = await questions_crud.get_question(db, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Savol topilmadi")
    await guard_serve(user.id, 1)
    return serialize_practice_question(question)


@user_router.post("/check-answer", response_model=CheckAnswerResponse)
@limiter.limit(settings.RATE_LIMIT_ANSWERS, key_func=questions_key)
@limiter.limit(settings.RATE_LIMIT_QUESTIONS_IP, key_func=_client_key)
async def check_answer(
    request: Request,
    payload: CheckAnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mashq javobini SERVER tomonida tekshiradi (to'g'ri javob oldindan ko'rinmaydi).

    Foydalanuvchi variant tanlagandan keyin chaqiriladi -> to'g'ri javob + izoh qaytadi.
    Xato bo'lsa savol avtomatik "xatolar" ro'yxatiga qo'shiladi.
    """
    question = await questions_crud.get_question(db, payload.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Savol topilmadi")
    correct_id = correct_option_id(question)
    is_correct = payload.option_id == correct_id
    if not is_correct:
        await interactions_crud.add_mistake(db, user.id, question.id)
        await db.commit()
    # Javob-kaliti bulk ekstraksiyasi nazorati (to'g'ri javob shu yerda oshkor bo'ladi)
    await guard_answer(user.id, payload.question_id)
    return CheckAnswerResponse(
        is_correct=is_correct,
        correct_option_id=correct_id,
        explanation=question_explanation(question),
    )


@admin_router.post("/check", response_model=CheckQuestionResponse)
async def check_question(
    payload: CheckQuestionRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    # Lotin/kirill farqsiz takror tekshiruvi ("Svetofor" == "Светофор").
    dup = await questions_crud.find_duplicate_question(db, payload.text)
    return CheckQuestionResponse(
        exists=dup is not None,
        duplicate_text=dup[1] if dup else None,
    )


@admin_router.post("/translate", response_model=TranslateResponse)
async def translate_questions(
    payload: TranslateRequest,
    _admin: User = Depends(get_current_admin),
):
    """Savol/variant matnlarini o'zbekchadan ruschaga o'giradi (internet kerak)."""
    translations, ok = await translate_many(payload.texts)
    return TranslateResponse(translations=translations, ok=ok)


@admin_router.get("", response_model=QuestionListResponse)
async def list_questions(
    topic_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    items, total = await questions_crud.list_questions(
        db, topic_id=topic_id, search=search, page=page, page_size=page_size
    )
    return {
        "items": [serialize_question(q) for q in items],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


@admin_router.post("", response_model=QuestionRead, status_code=status.HTTP_201_CREATED)
async def create_question(
    payload: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    topic = await topics_crud.get_topic(db, payload.topic_id)
    if topic is None:
        raise HTTPException(status_code=400, detail="Bunday mavzu mavjud emas")
    if not any(o.is_correct for o in payload.options):
        raise HTTPException(status_code=400, detail="Kamida bitta to'g'ri javob belgilang")

    data = payload.model_dump()
    question = await questions_crud.create_question(
        db,
        topic_id=data["topic_id"],
        text=data["text"],
        explanation=data.get("explanation"),
        image_url=data.get("image_url"),
        options=data["options"],
    )
    await db.commit()
    fresh = await questions_crud.get_question(db, question.id)
    return serialize_question(fresh)


@admin_router.put("/{question_id}", response_model=QuestionRead)
async def update_question(
    question_id: str,
    payload: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    question = await questions_crud.get_question(db, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Savol topilmadi")
    data = payload.model_dump(exclude_unset=True)
    await questions_crud.update_question(
        db,
        question,
        topic_id=data.get("topic_id"),
        text=data.get("text"),
        explanation=data.get("explanation"),
        image_url=data.get("image_url"),
        options=data.get("options"),
    )
    await db.commit()
    fresh = await questions_crud.get_question(db, question_id)
    return serialize_question(fresh)


@admin_router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    question = await questions_crud.get_question(db, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Savol topilmadi")
    await questions_crud.delete_question(db, question)
    await db.commit()


@admin_router.post("/{question_id}/image", response_model=ImageUploadResponse)
async def upload_question_image(
    question_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    question = await questions_crud.get_question(db, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Savol topilmadi")
    url = await save_question_image(file)
    question.image_url = url
    await db.commit()
    return ImageUploadResponse(image_url=url)
