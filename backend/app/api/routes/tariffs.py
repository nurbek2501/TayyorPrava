"""Tariff + payment-method routes (public read, admin manage)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.ratelimit import limiter
from app.crud import tariffs as tariffs_crud
from app.db.session import get_db
from app.deps import get_current_admin, get_current_user
from app.models.user import User
from app.schemas.tariff import (
    PaymentMethodRead,
    PaymentMethodUpdate,
    TariffCreate,
    TariffRead,
    TariffUpdate,
)
from app.services.serializers import serialize_payment_method, serialize_tariff

public_router = APIRouter(tags=["tariffs"])
admin_router = APIRouter(prefix="/admin", tags=["admin-tariffs"])


@public_router.get("/tariffs", response_model=list[TariffRead])
@limiter.limit(app_settings.RATE_LIMIT_PUBLIC)
async def list_active_tariffs(request: Request, db: AsyncSession = Depends(get_db)):
    tariffs = await tariffs_crud.list_tariffs(db, active_only=True)
    return [serialize_tariff(t) for t in tariffs]


@public_router.get("/payment-methods", response_model=list[PaymentMethodRead])
async def list_enabled_methods(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    methods = await tariffs_crud.list_payment_methods(db, enabled_only=True)
    return [serialize_payment_method(m) for m in methods]


@admin_router.get("/tariffs", response_model=list[TariffRead])
async def admin_list_tariffs(
    db: AsyncSession = Depends(get_db), _admin: User = Depends(get_current_admin)
):
    tariffs = await tariffs_crud.list_tariffs(db)
    return [serialize_tariff(t) for t in tariffs]


@admin_router.post("/tariffs", response_model=TariffRead, status_code=201)
async def admin_create_tariff(
    payload: TariffCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    tariff = await tariffs_crud.create_tariff(db, **payload.model_dump())
    await db.commit()
    return serialize_tariff(tariff)


@admin_router.put("/tariffs/{tariff_id}", response_model=TariffRead)
async def admin_update_tariff(
    tariff_id: str,
    payload: TariffUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    tariff = await tariffs_crud.get_tariff(db, tariff_id)
    if tariff is None:
        raise HTTPException(status_code=404, detail="Tarif topilmadi")
    await tariffs_crud.update_tariff(db, tariff, **payload.model_dump(exclude_unset=True))
    await db.commit()
    return serialize_tariff(tariff)


@admin_router.delete("/tariffs/{tariff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_tariff(
    tariff_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    tariff = await tariffs_crud.get_tariff(db, tariff_id)
    if tariff is None:
        raise HTTPException(status_code=404, detail="Tarif topilmadi")
    await tariffs_crud.delete_tariff(db, tariff)
    await db.commit()


@admin_router.get("/payment-methods", response_model=list[PaymentMethodRead])
async def admin_list_methods(
    db: AsyncSession = Depends(get_db), _admin: User = Depends(get_current_admin)
):
    methods = await tariffs_crud.list_payment_methods(db)
    return [serialize_payment_method(m) for m in methods]


@admin_router.patch("/payment-methods/{method_id}", response_model=PaymentMethodRead)
async def admin_update_method(
    method_id: str,
    payload: PaymentMethodUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    method = await tariffs_crud.get_payment_method(db, method_id)
    if method is None:
        raise HTTPException(status_code=404, detail="To'lov usuli topilmadi")
    await tariffs_crud.update_payment_method(
        db, method, **payload.model_dump(exclude_unset=True)
    )
    await db.commit()
    return serialize_payment_method(method)
