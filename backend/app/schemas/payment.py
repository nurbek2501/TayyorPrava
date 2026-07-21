"""Payment schemas."""
from datetime import datetime
from typing import Optional

from app.schemas.common import CamelModel


class PaymentCreate(CamelModel):
    tariff_id: str
    phone: str
    method: str


class PaymentRead(CamelModel):
    id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_nickname: Optional[str] = None
    tariff_id: Optional[str] = None
    tariff_title: Optional[str] = None
    method: str
    phone: str
    amount: int
    status: str
    created_at: datetime


class PaymentStatusUpdate(CamelModel):
    status: str


class PaymentListResponse(CamelModel):
    items: list[PaymentRead]
    total: int
    page: int
    page_size: int
