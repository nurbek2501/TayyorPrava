"""Tariff and payment-method schemas."""
from typing import Optional

from pydantic import Field

from app.schemas.common import CamelModel


class TariffRead(CamelModel):
    id: str
    title: str
    duration_days: int
    price: int
    type: str
    is_active: bool
    order_index: int = 0


class TariffCreate(CamelModel):
    title: str
    duration_days: int = Field(ge=1)
    price: int = Field(ge=0)
    type: str = "test_only"
    is_active: bool = True
    order_index: int = 0


class TariffUpdate(CamelModel):
    title: Optional[str] = None
    duration_days: Optional[int] = None
    price: Optional[int] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None


class PaymentMethodRead(CamelModel):
    id: str
    name: str
    code: str
    logo_url: str
    is_enabled: bool
    order_index: int = 0


class PaymentMethodUpdate(CamelModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    is_enabled: Optional[bool] = None
