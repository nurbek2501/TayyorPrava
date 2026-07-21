"""Topic routes (public list + admin CRUD)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import topics as topics_crud
from app.db.session import get_db
from app.deps import get_current_admin, get_current_user
from app.models.topic import Topic
from app.models.user import User
from app.schemas.topic import TopicCreate, TopicRead, TopicUpdate

router = APIRouter(prefix="/topics", tags=["topics"])
admin_router = APIRouter(prefix="/admin/topics", tags=["admin-topics"])


def _serialize(topic: Topic, count: int = 0) -> dict:
    return {
        "id": topic.id,
        "nameUz": topic.name_uz,
        "nameKaa": topic.name_kaa,
        "nameRu": topic.name_ru,
        "orderIndex": topic.order_index,
        "questionCount": count,
    }


@router.get("", response_model=list[TopicRead])
async def list_topics(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    rows = await topics_crud.list_topics(db)
    return [_serialize(t, c) for t, c in rows]


@admin_router.post("", response_model=TopicRead, status_code=status.HTTP_201_CREATED)
async def create_topic(
    payload: TopicCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    topic = await topics_crud.create_topic(db, **payload.model_dump())
    await db.commit()
    return _serialize(topic)


@admin_router.put("/{topic_id}", response_model=TopicRead)
async def update_topic(
    topic_id: int,
    payload: TopicUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    topic = await topics_crud.get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="Mavzu topilmadi")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(topic, key, value)
    await db.commit()
    return _serialize(topic)


@admin_router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(
    topic_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    topic = await topics_crud.get_topic(db, topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="Mavzu topilmadi")
    await topics_crud.delete_topic(db, topic)
    await db.commit()
