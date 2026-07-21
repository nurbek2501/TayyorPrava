"""Payment routes (user create, admin manage)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import payments as payments_crud
from app.crud import tariffs as tariffs_crud
from app.crud import users as users_crud
from app.db.session import get_db
from app.deps import get_current_admin, get_current_user
from app.models.enums import PaymentStatus
from app.models.user import User
from app.schemas.payment import (
    PaymentCreate,
    PaymentListResponse,
    PaymentRead,
    PaymentStatusUpdate,
)
from app.services.serializers import serialize_payment

router = APIRouter(tags=["payments"])
admin_router = APIRouter(prefix="/admin", tags=["admin-payments"])


@router.post("/payments", response_model=PaymentRead, status_code=201)
async def create_payment(
    payload: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tariff = await tariffs_crud.get_tariff(db, payload.tariff_id)
    if tariff is None or not tariff.is_active:
        raise HTTPException(status_code=400, detail="Tarif topilmadi yoki faol emas")
    payment = await payments_crud.create_payment(
        db,
        user_id=user.id,
        tariff_id=tariff.id,
        method=payload.method,
        phone=payload.phone,
        amount=tariff.price,
        category="tariff",
    )
    await db.commit()
    return serialize_payment(payment, user_name=user.name, tariff_title=tariff.title)


@admin_router.get("/payments", response_model=PaymentListResponse)
async def admin_list_payments(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    rows, total = await payments_crud.list_payments(db, page=page, page_size=page_size)
    return {
        "items": [
            serialize_payment(
                p, user_name=name, user_nickname=nickname, tariff_title=title
            )
            for p, name, nickname, title in rows
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


@admin_router.patch("/payments/{payment_id}", response_model=PaymentRead)
async def admin_update_payment(
    payment_id: str,
    payload: PaymentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    payment = await payments_crud.get_payment(db, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="To'lov topilmadi")
    try:
        new_status = PaymentStatus(payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Noto'g'ri status") from exc
    was_paid = payment.status == PaymentStatus.paid
    await payments_crud.update_payment_status(db, payment, new_status)
    # To'lov endi tasdiqlansa (paid) va tarifga tegishli bo'lsa -> foydalanuvchiga obuna beriladi.
    # Busiz to'lov tasdiqlansa ham paywall ochilmay qolardi (pulli user hech narsa olmasdi).
    if new_status == PaymentStatus.paid and not was_paid and payment.tariff_id and payment.user_id:
        tariff = await tariffs_crud.get_tariff(db, payment.tariff_id)
        if tariff is not None:
            await users_crud.grant_subscription(
                db,
                user_id=payment.user_id,
                tariff_id=tariff.id,
                duration_days=tariff.duration_days,
            )
    await db.commit()
    return serialize_payment(payment)
