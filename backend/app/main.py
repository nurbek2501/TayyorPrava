"""FastAPI application entrypoint."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

import app.models  # noqa: F401  (populate SQLAlchemy metadata)
from app.api.router import api_router
from app.core.abuse import AbuseGuardMiddleware, MaxBodySizeMiddleware
from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.core.ratelimit import limiter, rate_limit_exceeded_handler
from app.db.base import Base
from app.db.session import engine

setup_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Postgres'ga birinchi deploy'da image ichidagi app.db'dan kontentni ko'chiradi
    # (bo'sh bo'lsa; sqlite'da yoki to'la bo'lsa hech narsa qilmaydi).
    from app.db.bootstrap import bootstrap_from_sqlite
    await bootstrap_from_sqlite()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Prava Pro — avtotest platformasi REST API",
    lifespan=lifespan,
    # Production'da (DEBUG=False) API hujjatlari yopiladi — tuzilmani oshkor qilmaslik uchun.
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Rate limiting (slowapi): limit oshganda 429 + Retry-After qaytadi.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Kutilmagan xatolarni logga (to'liq trace) yozadi, mijozga toza 500 qaytaradi.

    Stack-trace mijozga chiqmaydi (xavfsizlik), lekin log/journal'da to'liq saqlanadi.
    """
    logger.exception("Kutilmagan xato: %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500, content={"detail": "Ichki server xatosi"}
    )

# Suiiste'mol/hujum qalqoni — CORS'dan OLDIN qo'shiladi (CORS tashqi qatlam bo'lib,
# 403/429 javoblariga ham CORS sarlavhalarini qo'shadi).
app.add_middleware(AbuseGuardMiddleware)

# So'rov hajmi cheklovi — juda katta yuk (DoS) tanani o'qimasdan 413 bilan rad etiladi.
# CORS ichida (so'ngroq qo'shilgan) turadi, shunda 413 javobiga ham CORS sarlavhalari qo'shiladi.
app.add_middleware(
    MaxBodySizeMiddleware, max_bytes=settings.MAX_REQUEST_MB * 1024 * 1024
)

app.add_middleware(
    CORSMiddleware,
    # Faqat ruxsat etilgan manzillar (CORS_ORIGINS .env orqali — prod domeningizni qo'shing).
    allow_origins=settings.cors_origins_list,
    # Mobil ilova (Capacitor/Ionic) va lokal WebView origin'lari uchun:
    allow_origin_regex=r"^(https?|capacitor|ionic)://localhost(:\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.UPLOAD_DIR), name="static")

app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["root"])
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "api": settings.API_PREFIX,
    }


@app.get(f"{settings.API_PREFIX}/health", tags=["root"])
async def health():
    return {"status": "ok"}
