"""Payment repository."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PaymentStatus
from app.models.tariff import Payment, Tariff
from app.models.user import User


async def create_payment(
    db: AsyncSession,
    *,
    user_id: Optional[str],
    tariff_id: str,
    method: str,
    phone: str,
    amount: int,
    category: Optional[str] = None,
) -> Payment:
    payment = Payment(
        user_id=user_id,
        tariff_id=tariff_id,
        method=method,
        phone=phone,
        amount=amount,
        category=category,
        status=PaymentStatus.pending,
    )
    db.add(payment)
    await db.flush()
    return payment


async def get_payment(db: AsyncSession, payment_id: str) -> Optional[Payment]:
    res = await db.execute(select(Payment).where(Payment.id == payment_id))
    return res.scalar_one_or_none()


async def list_payments(
    db: AsyncSession, *, page: int = 1, page_size: int = 20
) -> tuple[list[tuple[Payment, Optional[str], Optional[str], Optional[str]]], int]:
    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 100))
    total = (await db.execute(select(func.count()).select_from(Payment))).scalar_one()
    stmt = (
        select(Payment, User.name, User.nickname, Tariff.title)
        .outerjoin(User, Payment.user_id == User.id)
        .outerjoin(Tariff, Payment.tariff_id == Tariff.id)
        .order_by(Payment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()
    return [(p, name, nickname, title) for p, name, nickname, title in rows], total


async def update_payment_status(
    db: AsyncSession, payment: Payment, status: PaymentStatus
) -> Payment:
    payment.status = status
    await db.flush()
    return payment


def _today_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


async def count_today_payments(db: AsyncSession) -> int:
    stmt = select(func.count()).select_from(Payment).where(
        Payment.created_at >= _today_start()
    )
    return (await db.execute(stmt)).scalar_one() or 0


async def total_revenue(db: AsyncSession) -> int:
    stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == PaymentStatus.paid
    )
    return int((await db.execute(stmt)).scalar_one() or 0)
