"""User mistakes & favorites repository."""
from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question, UserFavorite, UserMistake


async def add_mistake(db: AsyncSession, user_id: str, question_id: str) -> None:
    exists = await db.execute(
        select(UserMistake.id).where(
            UserMistake.user_id == user_id, UserMistake.question_id == question_id
        )
    )
    if exists.first() is None:
        db.add(UserMistake(user_id=user_id, question_id=question_id))
        await db.flush()


async def clear_mistakes(db: AsyncSession, user_id: str) -> int:
    """Foydalanuvchining barcha xato savollarini o'chiradi."""
    res = await db.execute(
        delete(UserMistake).where(UserMistake.user_id == user_id)
    )
    await db.flush()
    return int(res.rowcount or 0)


async def toggle_favorite(db: AsyncSession, user_id: str, question_id: str) -> bool:
    res = await db.execute(
        select(UserFavorite).where(
            UserFavorite.user_id == user_id, UserFavorite.question_id == question_id
        )
    )
    fav = res.scalar_one_or_none()
    if fav:
        await db.delete(fav)
        await db.flush()
        return False
    db.add(UserFavorite(user_id=user_id, question_id=question_id))
    await db.flush()
    return True


async def list_mistake_questions(db: AsyncSession, user_id: str) -> list[Question]:
    res = await db.execute(
        select(Question)
        .join(UserMistake, UserMistake.question_id == Question.id)
        .where(UserMistake.user_id == user_id)
        .order_by(UserMistake.created_at.desc())
    )
    return list(res.scalars().all())


async def list_favorite_questions(db: AsyncSession, user_id: str) -> list[Question]:
    res = await db.execute(
        select(Question)
        .join(UserFavorite, UserFavorite.question_id == Question.id)
        .where(UserFavorite.user_id == user_id)
        .order_by(UserFavorite.created_at.desc())
    )
    return list(res.scalars().all())


async def count_mistakes(db: AsyncSession, user_id: str) -> int:
    return (
        await db.execute(
            select(func.count()).select_from(UserMistake).where(
                UserMistake.user_id == user_id
            )
        )
    ).scalar_one() or 0


async def count_favorites(db: AsyncSession, user_id: str) -> int:
    return (
        await db.execute(
            select(func.count()).select_from(UserFavorite).where(
                UserFavorite.user_id == user_id
            )
        )
    ).scalar_one() or 0
