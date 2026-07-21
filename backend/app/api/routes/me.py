"""Current-user data: stats, mistakes, favorites, referral."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import interactions as interactions_crud
from app.crud import questions as questions_crud
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import Referral, User
from app.schemas.dashboard import MeStats, ReferralStats
from app.schemas.question import PracticeQuestionRead
from app.services.serializers import serialize_practice_question

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/stats", response_model=MeStats)
async def my_stats(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    favorites = await interactions_crud.count_favorites(db, user.id)
    mistakes = await interactions_crud.count_mistakes(db, user.id)
    total_q = await questions_crud.count_questions(db)
    percent = round((mistakes / total_q * 100.0), 1) if total_q else 0.0
    return MeStats(favorites=favorites, mistakes=mistakes, all_mistakes_percent=percent)


@router.get("/mistakes", response_model=list[PracticeQuestionRead])
async def my_mistakes(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    questions = await interactions_crud.list_mistake_questions(db, user.id)
    return [serialize_practice_question(q) for q in questions]


@router.get("/favorites", response_model=list[PracticeQuestionRead])
async def my_favorites(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    questions = await interactions_crud.list_favorite_questions(db, user.id)
    return [serialize_practice_question(q) for q in questions]


@router.post("/favorites")
async def toggle_favorite(
    question_id: str = Body(..., embed=True, alias="questionId"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if await questions_crud.get_question(db, question_id) is None:
        raise HTTPException(status_code=404, detail="Savol topilmadi")
    is_fav = await interactions_crud.toggle_favorite(db, user.id, question_id)
    await db.commit()
    return {"favorite": is_fav}


@router.post("/mistakes")
async def add_mistake(
    question_id: str = Body(..., embed=True, alias="questionId"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if await questions_crud.get_question(db, question_id) is None:
        raise HTTPException(status_code=404, detail="Savol topilmadi")
    await interactions_crud.add_mistake(db, user.id, question_id)
    await db.commit()
    return {"success": True}


@router.delete("/mistakes")
async def clear_mistakes(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    cleared = await interactions_crud.clear_mistakes(db, user.id)
    await db.commit()
    return {"cleared": cleared}


@router.get("/referral", response_model=ReferralStats)
async def my_referral(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    invited = (
        await db.execute(
            select(func.count()).select_from(Referral).where(
                Referral.referrer_id == user.id
            )
        )
    ).scalar_one() or 0
    paid = (
        await db.execute(
            select(func.count()).select_from(Referral).where(
                Referral.referrer_id == user.id, Referral.has_paid.is_(True)
            )
        )
    ).scalar_one() or 0
    code = user.ref_code or ""
    return ReferralStats(
        bonus=int(user.bonus_balance or 0),  # sarflanadigan balans
        invited=int(invited),
        paid=int(paid),
        ref_code=code,
        ref_link=f"https://pravapro.uz/register?ref={code}",
    )
