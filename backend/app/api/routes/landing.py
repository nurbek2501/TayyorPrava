"""Public landing (guest panel) route — admin-managed content + live stats."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.ratelimit import limiter
from app.crud import questions as questions_crud
from app.crud import settings as settings_crud
from app.db.session import get_db
from app.models.enums import ExamStatus, Role
from app.models.exam import RealExamSession
from app.models.user import User
from app.schemas.settings import LandingRead

router = APIRouter(prefix="/landing", tags=["landing"])


async def _scalar(db: AsyncSession, stmt) -> int:
    return int((await db.execute(stmt)).scalar_one() or 0)


@router.get("", response_model=LandingRead)
@limiter.limit(app_settings.RATE_LIMIT_PUBLIC)
async def get_landing(request: Request, db: AsyncSession = Depends(get_db)):
    s = await settings_crud.get_settings(db)

    total_questions = await questions_crud.count_questions(db)
    total_users = await _scalar(
        db, select(func.count()).select_from(User).where(User.role == Role.user)
    )
    exams_total = await _scalar(
        db,
        select(func.count())
        .select_from(RealExamSession)
        .where(RealExamSession.status == ExamStatus.finished),
    )
    passed = await _scalar(
        db,
        select(func.count())
        .select_from(RealExamSession)
        .where(
            RealExamSession.status == ExamStatus.finished,
            RealExamSession.passed.is_(True),
        ),
    )
    pass_rate = round(passed / exams_total * 100.0, 1) if exams_total else 0.0
    await db.commit()

    return {
        "siteName": s.site_name,
        "badge": s.landing_badge,
        "title": s.landing_title,
        "subtitle": s.landing_subtitle,
        "cta": s.landing_cta,
        "telegram": s.landing_telegram,
        "phone": s.landing_phone,
        "stats": {
            "questions": total_questions,
            "users": total_users,
            "exams": exams_total,
            "passRate": pass_rate,
        },
    }
