"""Aggregate all route modules under a single API router."""
from fastapi import APIRouter

from app.api.routes import (
    auth,
    bot,
    dashboard,
    exam,
    landing,
    me,
    payments,
    promo,
    questions,
    referral,
    road_signs,
    settings,
    smart_test,
    tariffs,
    teachers,
    topics,
    users,
)

api_router = APIRouter()

# Auth
api_router.include_router(auth.router)
api_router.include_router(auth.admin_router)

# Telegram bot (ichki)
api_router.include_router(bot.router)

# Topics & questions
api_router.include_router(topics.router)
api_router.include_router(topics.admin_router)
api_router.include_router(questions.user_router)
api_router.include_router(questions.admin_router)

# Exam / real-exam
api_router.include_router(exam.router)

# Smart test (aqlli test)
api_router.include_router(smart_test.router)

# Current user
api_router.include_router(me.router)

# Public landing (guest panel)
api_router.include_router(landing.router)

# Yo'l belgilari (road signs)
api_router.include_router(road_signs.router)

# Tariffs & payments
api_router.include_router(tariffs.public_router)
api_router.include_router(tariffs.admin_router)
api_router.include_router(payments.router)
api_router.include_router(payments.admin_router)

# Ustoz (maslahat) tizimi
api_router.include_router(teachers.user_router)
api_router.include_router(teachers.teacher_router)
api_router.include_router(teachers.admin_router)

# Admin management
api_router.include_router(users.admin_router)
api_router.include_router(settings.admin_router)
api_router.include_router(referral.admin_router)
api_router.include_router(dashboard.admin_router)
api_router.include_router(promo.admin_router)
