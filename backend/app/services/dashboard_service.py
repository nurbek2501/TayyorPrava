"""Admin dashboard aggregation logic."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import payments as payments_crud
from app.crud import questions as questions_crud
from app.models.enums import ExamStatus, PaymentStatus, Role
from app.models.exam import RealExamSession
from app.models.exam_access import RealExamAccess
from app.models.tariff import Payment
from app.models.topic import Topic
from app.models.user import Referral, Subscription, User

_RANGES = {"7d": 7, "30d": 30, "90d": 90}


def _today_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


async def _scalar(db: AsyncSession, stmt) -> int:
    return int((await db.execute(stmt)).scalar_one() or 0)


async def summary(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    today = _today_start()

    total_questions = await questions_crud.count_questions(db)
    total_users = await _scalar(
        db, select(func.count()).select_from(User).where(User.role == Role.user)
    )
    active_subscriptions = await _scalar(
        db,
        select(func.count())
        .select_from(Subscription)
        .where(
            Subscription.is_active.is_(True),
            or_(Subscription.expires_at.is_(None), Subscription.expires_at > now),
        ),
    )
    today_payments = await payments_crud.count_today_payments(db)
    total_revenue = await payments_crud.total_revenue(db)
    referral_signups = await _scalar(db, select(func.count()).select_from(Referral))
    new_users_today = await _scalar(
        db,
        select(func.count())
        .select_from(User)
        .where(User.role == Role.user, User.created_at >= today),
    )
    exams_today = await _scalar(
        db,
        select(func.count())
        .select_from(RealExamSession)
        .where(
            RealExamSession.status == ExamStatus.finished,
            RealExamSession.finished_at >= today,
        ),
    )
    exams_total = await _scalar(
        db,
        select(func.count())
        .select_from(RealExamSession)
        .where(RealExamSession.status == ExamStatus.finished),
    )
    avg_score = (
        await db.execute(
            select(func.avg(RealExamSession.correct * 100.0 / RealExamSession.total)).where(
                RealExamSession.status == ExamStatus.finished,
                RealExamSession.total > 0,
            )
        )
    ).scalar_one()
    passed = await _scalar(
        db,
        select(func.count())
        .select_from(RealExamSession)
        .where(
            RealExamSession.status == ExamStatus.finished,
            RealExamSession.passed.is_(True),
        ),
    )
    pass_rate = (passed / exams_total * 100.0) if exams_total else 0.0

    # Real imtihon pulli kirish daromadi — FAQAT real imtihon to'lovlari.
    # Avval "tariff_id IS NULL" bo'yicha hisoblanardi, lekin ustoz maslahati to'lovlari
    # ham tariff_id=None bilan yoziladi -> ular ham noto'g'ri qo'shilardi. Endi aniq
    # category diskriminatori bo'yicha ajratiladi. Eski (category=NULL) yozuvlar
    # migratsiyada backfill qilingan (phone='' -> real_exam, aks holda teacher).
    real_exam_revenue = await _scalar(
        db,
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.status == PaymentStatus.paid,
            Payment.category == "real_exam",
        ),
    )
    real_exam_entries = await _scalar(
        db, select(func.count()).select_from(RealExamAccess)
    )
    telegram_bound = await _scalar(
        db,
        select(func.count())
        .select_from(User)
        .where(User.role == Role.user, User.telegram_id.isnot(None)),
    )

    return {
        "totalQuestions": total_questions,
        "totalUsers": total_users,
        "activeSubscriptions": active_subscriptions,
        "todayPayments": today_payments,
        "totalRevenue": total_revenue,
        "referralSignups": referral_signups,
        "newUsersToday": new_users_today,
        "examsToday": exams_today,
        "examsTotal": exams_total,
        "avgExamScore": round(float(avg_score or 0), 1),
        "passRate": round(pass_rate, 1),
        "realExamRevenue": real_exam_revenue,
        "realExamEntries": real_exam_entries,
        "telegramBound": telegram_bound,
    }


async def timeseries(db: AsyncSession, range_str: str) -> dict:
    days = _RANGES.get(range_str, 7)
    start = _today_start() - timedelta(days=days - 1)

    buckets: dict[str, dict] = {}
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        buckets[d] = {"registrations": 0, "payments": 0, "revenue": 0}

    # Bazada GROUP BY — barcha qatorlarni Python'ga tortmaymiz (100k+ uchun muhim).
    reg_rows = (
        await db.execute(
            select(func.date(User.created_at), func.count())
            .where(User.created_at >= start, User.role == Role.user)
            .group_by(func.date(User.created_at))
        )
    ).all()
    for d, cnt in reg_rows:
        key = str(d)[:10]
        if key in buckets:
            buckets[key]["registrations"] = int(cnt or 0)

    pay_rows = (
        await db.execute(
            select(
                func.date(Payment.created_at),
                func.count(),
                func.coalesce(
                    func.sum(
                        case((Payment.status == PaymentStatus.paid, Payment.amount), else_=0)
                    ),
                    0,
                ),
            )
            .where(Payment.created_at >= start)
            .group_by(func.date(Payment.created_at))
        )
    ).all()
    for d, cnt, rev in pay_rows:
        key = str(d)[:10]
        if key in buckets:
            buckets[key]["payments"] = int(cnt or 0)
            buckets[key]["revenue"] = int(rev or 0)

    points = [{"date": d, **v} for d, v in buckets.items()]
    return {"range": range_str, "points": points}


async def topic_distribution(db: AsyncSession) -> dict:
    dist = dict(await questions_crud.topic_distribution(db))
    topics = (await db.execute(select(Topic).order_by(Topic.order_index, Topic.id))).scalars().all()
    items = [
        {"topicId": t.id, "name": t.name_uz, "count": dist.get(t.id, 0)}
        for t in topics
        if dist.get(t.id, 0) > 0
    ]
    items.sort(key=lambda x: x["count"], reverse=True)
    return {"items": items}


async def pass_rate(db: AsyncSession) -> dict:
    passed = await _scalar(
        db,
        select(func.count())
        .select_from(RealExamSession)
        .where(
            RealExamSession.status == ExamStatus.finished,
            RealExamSession.passed.is_(True),
        ),
    )
    total = await _scalar(
        db,
        select(func.count())
        .select_from(RealExamSession)
        .where(RealExamSession.status == ExamStatus.finished),
    )
    return {"passed": passed, "failed": max(total - passed, 0)}
