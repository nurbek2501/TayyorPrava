"""Tariff and payment-method repository."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tariff import PaymentMethod, Tariff


async def list_tariffs(db: AsyncSession, *, active_only: bool = False) -> list[Tariff]:
    stmt = select(Tariff)
    if active_only:
        stmt = stmt.where(Tariff.is_active.is_(True))
    stmt = stmt.order_by(Tariff.order_index, Tariff.price)
    return list((await db.execute(stmt)).scalars().all())


async def get_tariff(db: AsyncSession, tariff_id: str) -> Optional[Tariff]:
    res = await db.execute(select(Tariff).where(Tariff.id == tariff_id))
    return res.scalar_one_or_none()


async def create_tariff(db: AsyncSession, **data) -> Tariff:
    tariff = Tariff(**data)
    db.add(tariff)
    await db.flush()
    return tariff


async def update_tariff(db: AsyncSession, tariff: Tariff, **data) -> Tariff:
    for key, value in data.items():
        if value is not None:
            setattr(tariff, key, value)
    await db.flush()
    return tariff


async def delete_tariff(db: AsyncSession, tariff: Tariff) -> None:
    await db.delete(tariff)


async def list_payment_methods(
    db: AsyncSession, *, enabled_only: bool = False
) -> list[PaymentMethod]:
    stmt = select(PaymentMethod)
    if enabled_only:
        stmt = stmt.where(PaymentMethod.is_enabled.is_(True))
    stmt = stmt.order_by(PaymentMethod.order_index)
    return list((await db.execute(stmt)).scalars().all())


async def get_payment_method(db: AsyncSession, method_id: str) -> Optional[PaymentMethod]:
    res = await db.execute(select(PaymentMethod).where(PaymentMethod.id == method_id))
    return res.scalar_one_or_none()


async def update_payment_method(
    db: AsyncSession, method: PaymentMethod, **data
) -> PaymentMethod:
    for key, value in data.items():
        if value is not None:
            setattr(method, key, value)
    await db.flush()
    return method
