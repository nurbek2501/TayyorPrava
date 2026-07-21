"""Admin: chegirma promokodlari CRUD (real imtihon narxiga foizli chegirma)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import promo as promo_crud
from app.db.session import get_db
from app.deps import get_current_admin
from app.models.user import User
from app.schemas.promo import PromoCodeCreate, PromoCodeRead, PromoCodeUpdate

admin_router = APIRouter(prefix="/admin/promo-codes", tags=["admin-promo"])


@admin_router.get("", response_model=list[PromoCodeRead])
async def list_promo_codes(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    return await promo_crud.list_promo_codes(db)


@admin_router.post("", response_model=PromoCodeRead, status_code=status.HTTP_201_CREATED)
async def create_promo_code(
    payload: PromoCodeCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    existing = await promo_crud.get_by_code_any(db, payload.code)
    if existing is not None:
        raise HTTPException(status_code=400, detail="Bunday promokod allaqachon mavjud")
    promo = await promo_crud.create_promo_code(
        db, code=payload.code, discount_percent=payload.discount_percent
    )
    await db.commit()
    return promo


@admin_router.patch("/{promo_id}", response_model=PromoCodeRead)
async def update_promo_code(
    promo_id: str,
    payload: PromoCodeUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    promo = await promo_crud.get_promo_code(db, promo_id)
    if promo is None:
        raise HTTPException(status_code=404, detail="Promokod topilmadi")
    data = payload.model_dump(exclude_unset=True)
    await promo_crud.update_promo_code(
        db,
        promo,
        discount_percent=data.get("discount_percent"),
        is_active=data.get("is_active"),
    )
    await db.commit()
    return promo


@admin_router.delete("/{promo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promo_code(
    promo_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    promo = await promo_crud.get_promo_code(db, promo_id)
    if promo is None:
        raise HTTPException(status_code=404, detail="Promokod topilmadi")
    await promo_crud.delete_promo_code(db, promo)
    await db.commit()
