"""Topic repository."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.models.topic import Topic


async def list_topics(db: AsyncSession) -> list[tuple[Topic, int]]:
    """Return topics with their question counts."""
    count_subq = (
        select(Question.topic_id, func.count(Question.id).label("cnt"))
        .group_by(Question.topic_id)
        .subquery()
    )
    stmt = (
        select(Topic, func.coalesce(count_subq.c.cnt, 0))
        .outerjoin(count_subq, Topic.id == count_subq.c.topic_id)
        .order_by(Topic.order_index, Topic.id)
    )
    res = await db.execute(stmt)
    return [(t, c) for t, c in res.all()]


async def get_topic(db: AsyncSession, topic_id: int) -> Optional[Topic]:
    res = await db.execute(select(Topic).where(Topic.id == topic_id))
    return res.scalar_one_or_none()


async def create_topic(db: AsyncSession, **data) -> Topic:
    topic = Topic(**data)
    db.add(topic)
    await db.flush()
    return topic


async def delete_topic(db: AsyncSession, topic: Topic) -> None:
    await db.delete(topic)
