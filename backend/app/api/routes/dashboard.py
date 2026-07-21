"""Admin dashboard routes (stats + charts)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps import get_current_admin
from app.models.user import User
from app.schemas.dashboard import (
    DashboardSummary,
    PassRateResponse,
    TimeseriesResponse,
    TopicDistributionResponse,
)
from app.services import dashboard_service

admin_router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])


@admin_router.get("/summary", response_model=DashboardSummary)
async def summary(
    db: AsyncSession = Depends(get_db), _admin: User = Depends(get_current_admin)
):
    return await dashboard_service.summary(db)


@admin_router.get("/timeseries", response_model=TimeseriesResponse)
async def timeseries(
    range: str = "7d",
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    return await dashboard_service.timeseries(db, range)


@admin_router.get("/topics-distribution", response_model=TopicDistributionResponse)
async def topics_distribution(
    db: AsyncSession = Depends(get_db), _admin: User = Depends(get_current_admin)
):
    return await dashboard_service.topic_distribution(db)


@admin_router.get("/exam-pass-rate", response_model=PassRateResponse)
async def exam_pass_rate(
    db: AsyncSession = Depends(get_db), _admin: User = Depends(get_current_admin)
):
    return await dashboard_service.pass_rate(db)
