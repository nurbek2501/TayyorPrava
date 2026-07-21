"""Telegram bot <-> backend ichki endpointi (shared secret bilan himoyalangan).

Bot foydalanuvchining kanalga obunasini tekshirgach, shu endpoint orqali
5 xonali kod so'raydi. Kodni backend yaratadi va saqlaydi (5 daqiqa amal qiladi).
"""
from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud import auth_codes as auth_codes_crud
from app.crud import users as users_crud
from app.db.session import get_db
from app.schemas.auth import BotIssueCodeRequest, BotIssueCodeResponse

router = APIRouter(prefix="/bot", tags=["bot"])


async def _verify_secret(x_bot_secret: str = Header(default="")):
    expected = settings.BOT_SHARED_SECRET
    # Kalit sozlanmagan (bo'sh) bo'lsa — endpoint butunlay qulflanadi (xavfsiz default).
    # Solishtiruv doimiy-vaqtli (compare_digest) — timing-attack orqali kalit topilmasin.
    if not expected or not secrets.compare_digest(x_bot_secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Yaroqsiz bot kaliti"
        )


@router.post(
    "/issue-code",
    response_model=BotIssueCodeResponse,
    dependencies=[Depends(_verify_secret)],
)
async def issue_code(payload: BotIssueCodeRequest, db: AsyncSession = Depends(get_db)):
    """Nik bo'yicha 5 xonali kod yaratadi. Maqsad avtomatik aniqlanadi:
    pending ro'yxat bo'lsa -> "register", mavjud user bo'lsa -> "reset"."""
    nick = payload.nickname.strip()
    pending = await auth_codes_crud.get_pending(db, nick)
    user = await users_crud.get_user_by_nickname(db, nick)

    # --- Bir Telegram = bir nik ---
    tg = (payload.telegram_id or "").strip()
    if tg:
        # (a) Bu telegram allaqachon BOSHQA nikka bog'langanmi?
        owner = await users_crud.get_user_by_telegram_id(db, tg)
        if owner is not None and (user is None or owner.id != user.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Bu sizning nikingiz emas — bu Telegram akkaunt "
                    f"«{owner.nickname}» nikiga bog'langan."
                ),
            )
        # (b) So'ralayotgan nik boshqa telegramga bog'langanmi? (birovnikini tiklab bo'lmaydi)
        if user is not None and user.telegram_id and user.telegram_id != tg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"«{nick}» niki boshqa Telegram akkauntga bog'langan.",
            )

    if pending is not None:
        purpose = "register"
        first_name = pending.first_name
    elif user is not None:
        # XAVFSIZLIK: parol tiklash kodi FAQAT akkauntga BOG'LANGAN Telegramга beriladi.
        # Telegramga umuman bog'lanmagan akkaunt (masalan admin yaratgan ustoz yoki
        # eski seed hisob) uchun kod berilsa — ISTALGAN begona Telegram reset kodi olib,
        # parolni almashtirib akkauntni EGALLAB olishi mumkin edi (tasdiqlangan teshik).
        # Bunday akkauntlar login/parolini admin/panel orqali boshqaradi.
        if not (user.telegram_id or "").strip():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Bu akkaunt Telegramga bog'lanmagan, shuning uchun bot orqali "
                    "parol tiklab bo'lmaydi. Administrator bilan bog'laning."
                ),
            )
        purpose = "reset"
        first_name = user.name
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bunday nik topilmadi. Avval saytda ro'yxatdan o'ting.",
        )

    code = await auth_codes_crud.create_code(
        db,
        nickname=nick,
        purpose=purpose,
        telegram_id=payload.telegram_id,
        ttl_minutes=settings.CODE_TTL_MINUTES,
    )
    await db.commit()
    return BotIssueCodeResponse(
        code=code.code,
        purpose=purpose,
        expires_at=code.expires_at,
        first_name=first_name,
    )
