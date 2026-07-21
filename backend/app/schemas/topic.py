"""Topic schemas."""
from typing import Optional

from app.schemas.common import CamelModel


class TopicRead(CamelModel):
    id: int
    name_uz: str
    name_kaa: str
    name_ru: str
    order_index: int
    question_count: int = 0


class TopicCreate(CamelModel):
    name_uz: str
    name_kaa: str = ""
    name_ru: str = ""
    order_index: int = 0


class TopicUpdate(CamelModel):
    name_uz: Optional[str] = None
    name_kaa: Optional[str] = None
    name_ru: Optional[str] = None
    order_index: Optional[int] = None
