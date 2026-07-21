"""Populate the database with initial data.

Run from the `backend/` directory:

    python -m app.seed
"""
from __future__ import annotations

import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

import app.models  # noqa: F401
from app.core.security import hash_password
from app.crud import questions as questions_crud
from app.data_import import import_questions, topics as pdd_topics
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.enums import ExamStatus, PaymentStatus, Role
from app.models.exam import RealExamSession
from app.models.settings import Settings
from app.models.tariff import Payment, PaymentMethod, Tariff
from app.models.topic import Topic
from app.models.user import Referral, Subscription, User

random.seed(42)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def seed_settings(db) -> None:
    exists = (await db.execute(select(Settings).where(Settings.id == 1))).scalar_one_or_none()
    if exists is None:
        db.add(Settings(id=1))
        await db.flush()
        print("  -settings created")


async def seed_topics(db) -> None:
    count = (await db.execute(select(func.count()).select_from(Topic))).scalar_one()
    if count:
        print(f"  -topics skipped ({count} already)")
        return
    tlist = pdd_topics()
    for t in tlist:
        db.add(
            Topic(
                id=t["id"],
                name_uz=t["name_uz"],
                name_kaa=t["name_kaa"],
                name_ru=t["name_ru"],
                order_index=t["id"],
            )
        )
    await db.flush()
    print(f"  -{len(tlist)} topics created")


async def seed_admin(db) -> None:
    admin = (await db.execute(select(User).where(User.phone == "admin"))).scalar_one_or_none()
    if admin is None:
        db.add(
            User(
                name="Administrator",
                phone="admin",
                email="admin@pravapro.uz",
                password_hash=hash_password("admin"),
                role=Role.admin,
                ref_code="ADMIN001",
            )
        )
        await db.flush()
        print("  -admin created (login: admin / parol: admin)")


async def seed_tariffs(db) -> None:
    count = (await db.execute(select(func.count()).select_from(Tariff))).scalar_one()
    if count:
        print(f"  -tariffs skipped ({count} already)")
        return
    tariffs = [
        ("2 hafta faqat test", 14, 45000, "test_only", 1),
        ("1 oy faqat test", 30, 70000, "test_only", 2),
        ("3 oy faqat test", 90, 150000, "test_only", 3),
        ("1 oy to'liq (test + video)", 30, 120000, "full", 4),
    ]
    for title, days, price, type_, order in tariffs:
        db.add(
            Tariff(
                title=title,
                duration_days=days,
                price=price,
                type=type_,
                is_active=True,
                order_index=order,
            )
        )
    await db.flush()
    print(f"  -{len(tariffs)} tariffs created")


async def seed_payment_methods(db) -> None:
    count = (await db.execute(select(func.count()).select_from(PaymentMethod))).scalar_one()
    if count:
        print(f"  -payment methods skipped ({count} already)")
        return
    methods = [
        ("Payme", "payme", 1),
        ("Click", "click", 2),
        ("UzumBank", "uzumbank", 3),
        ("SelloPay", "sellopay", 4),
    ]
    for name, code, order in methods:
        db.add(
            PaymentMethod(name=name, code=code, logo_url="", is_enabled=True, order_index=order)
        )
    await db.flush()
    print(f"  -{len(methods)} payment methods created")


async def seed_questions(db) -> None:
    count = await questions_crud.count_questions(db)
    if count:
        print(f"  -questions skipped ({count} already)")
        return
    n = await import_questions(db)
    print(f"  - {n} questions imported (3-tilli) from pdd_1224.json")


async def seed_demo(db) -> None:
    user_count = (
        await db.execute(
            select(func.count()).select_from(User).where(User.role == Role.user)
        )
    ).scalar_one()
    if user_count:
        print(f"  -demo data skipped ({user_count} users already)")
        return

    names = [
        "Akmal Karimov", "Dilnoza Yusupova", "Sardor Aliyev", "Malika Tosheva",
        "Jasur Rahimov", "Nodira Saidova", "Bekzod Umarov", "Gulnora Ergasheva",
        "Shaxzod Qodirov", "Kamola Nazarova", "Otabek Yo'ldoshev", "Sevara Mirzaeva",
        "Rustam Tursunov", "Feruza Abdullaeva", "Aziz Sharipov",
    ]
    tariffs = (await db.execute(select(Tariff))).scalars().all()
    admin = (await db.execute(select(User).where(User.phone == "admin"))).scalar_one()

    users: list[User] = []
    for i, name in enumerate(names):
        created = _now() - timedelta(days=random.randint(0, 29), hours=random.randint(0, 23))
        user = User(
            name=name,
            phone=f"+9989{1000000 + i}",
            email=f"user{i}@example.com",
            password_hash=hash_password("user123"),
            role=Role.user,
            ref_code=f"REF{1000 + i}",
            referred_by="ADMIN001" if i % 3 == 0 else None,
            created_at=created,
        )
        db.add(user)
        users.append(user)
    await db.flush()

    # Referrals (invited by admin)
    for i, user in enumerate(users):
        if user.referred_by == "ADMIN001":
            db.add(
                Referral(
                    referrer_id=admin.id,
                    referred_user_id=user.id,
                    has_paid=(i % 2 == 0),
                    bonus=10000 if i % 2 == 0 else 0,
                    created_at=user.created_at,
                )
            )

    # Subscriptions + payments
    for i, user in enumerate(users):
        if i % 2 == 0 and tariffs:
            tariff = random.choice(tariffs)
            start = user.created_at
            db.add(
                Subscription(
                    user_id=user.id,
                    tariff_id=tariff.id,
                    starts_at=start,
                    expires_at=start + timedelta(days=tariff.duration_days),
                    is_active=True,
                )
            )
            for _ in range(random.randint(1, 2)):
                pay_date = _now() - timedelta(days=random.randint(0, 27))
                db.add(
                    Payment(
                        user_id=user.id,
                        tariff_id=tariff.id,
                        method=random.choice(["payme", "click", "uzumbank", "sellopay"]),
                        phone=user.phone,
                        amount=tariff.price,
                        status=PaymentStatus.paid,
                        created_at=pay_date,
                    )
                )

    # A few pending payments (today)
    for user in random.sample(users, 3):
        tariff = random.choice(tariffs)
        db.add(
            Payment(
                user_id=user.id,
                tariff_id=tariff.id,
                method="payme",
                phone=user.phone,
                amount=tariff.price,
                status=PaymentStatus.pending,
                created_at=_now(),
            )
        )

    # Finished real-exam sessions (for pass-rate / avg score charts)
    for i, user in enumerate(users):
        for _ in range(random.randint(0, 2)):
            correct = random.randint(14, 20)
            finished = _now() - timedelta(days=random.randint(0, 6), hours=random.randint(0, 12))
            db.add(
                RealExamSession(
                    user_id=user.id,
                    lang="uz",
                    total=20,
                    correct=correct,
                    mistakes=20 - correct,
                    passed=(20 - correct) <= 2,
                    pass_max_mistakes=2,
                    duration_sec=1500,
                    status=ExamStatus.finished,
                    created_at=finished,
                    finished_at=finished,
                )
            )

    await db.flush()
    print(f"  -{len(users)} demo users + subscriptions + payments + exams created")


async def seed() -> None:
    print("Seeding Prava Pro database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        await seed_settings(db)
        await seed_topics(db)
        await seed_admin(db)
        await seed_tariffs(db)
        await seed_payment_methods(db)
        await seed_questions(db)
        await seed_demo(db)
        await db.commit()
    await engine.dispose()
    print("Done.")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
