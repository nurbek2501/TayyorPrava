"""Base schema config and shared types."""
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_serializer
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """All API schemas serialize to camelCase but also accept snake_case input."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_serializer("*", when_used="json", check_fields=False)
    def _serialize_naive_datetime_as_utc(self, value: object) -> object:
        # DB (SQLite) naive UTC datetime saqlaydi va offsetSIZ serialize qilinardi
        # ("2026-07-21T07:32:37"). Frontend `new Date(...)` buni LOKAL vaqt deb oladi
        # -> Toshkentda (UTC+5) barcha sanalar 5 soat NOTO'G'RI ko'rinardi.
        # Naive datetime'ni UTC deb belgilaymiz -> "+00:00" offset bilan chiqadi,
        # frontend uni to'g'ri mahalliy vaqtga aylantiradi. Boshqa tiplar o'zgarmaydi.
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class LocalizedText(CamelModel):
    kaa: str = ""
    uz: str = ""
    ru: str = ""
