"""Authentication routes (user + admin)."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.ratelimit import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password_async,
    verify_password_async,
)
from app.core.validators import nickname_error, password_error
from app.crud import auth_codes as auth_codes_crud
from app.crud import settings as settings_crud
from app.crud import users as users_crud
from app.db.session import get_db
from app.deps import get_current_admin, get_current_user
from app.models.enums import Role
from app.models.user import User
from app.schemas.auth import (
    AdminCredentialsResponse,
    AdminLoginRequest,
    AdminUpdateCredentialsRequest,
    ChangePasswordRequest,
    CheckNicknameRequest,
    CheckNicknameResponse,
    CheckPromoRequest,
    CheckPromoResponse,
    CodeStatusRequest,
    CodeStatusResponse,
    LoginRequest,
    OkResponse,
    RefreshRequest,
    RegisterInitResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyCodeRequest,
)
from app.schemas.user import UserRead, UserUpdate
from app.services.serializers import serialize_user

router = APIRouter(prefix="/auth", tags=["auth"])
admin_router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


def _tokens(user: User) -> TokenResponse:
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    return TokenResponse(
        access_token=create_access_token(user.id, role),
        refresh_token=create_refresh_token(user.id, role),
    )


@router.post("/check-nickname", response_model=CheckNicknameResponse)
@limiter.limit("30/minute")
async def check_nickname(
    request: Request,
    payload: CheckNicknameRequest,
    db: AsyncSession = Depends(get_db),
):
    """Nik qoidalarga mosligini va band emasligini tekshiradi (jonli, forma uchun).

    Rate-limit (30/min) — nik enumeratsiyasini (mavjud niklarni skanerlash) yumshatadi.
    """
    err = nickname_error(payload.nickname)
    if err:
        return CheckNicknameResponse(available=False, error=err)
    if await users_crud.get_user_by_nickname(db, payload.nickname):
        return CheckNicknameResponse(available=False, error="Bu nik allaqachon band")
    return CheckNicknameResponse(available=True)


@router.post("/check-promo", response_model=CheckPromoResponse)
@limiter.limit("30/minute")
async def check_promo(
    request: Request,
    payload: CheckPromoRequest,
    db: AsyncSession = Depends(get_db),
):
    """Promokod (taklif kodi) haqiqiyligini tekshiradi — ro'yxatda jonli (30/min)."""
    code = (payload.code or "").strip().upper()
    if not code:
        return CheckPromoResponse(valid=False)
    inviter = await users_crud.get_user_by_ref_code(db, code)
    if inviter is None:
        return CheckPromoResponse(valid=False)
    return CheckPromoResponse(valid=True, name=inviter.name)


@router.post("/register-init", response_model=RegisterInitResponse)
@limiter.limit("5/minute")
async def register_init(
    request: Request, payload: RegisterRequest, db: AsyncSession = Depends(get_db)
):
    """1-qadam: forma tekshiriladi va pending saqlanadi. Keyin Telegram orqali tasdiq."""
    err = nickname_error(payload.nickname) or password_error(payload.password)
    if err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    if await users_crud.get_user_by_nickname(db, payload.nickname):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Bu nik allaqachon band"
        )
    referred_by = None
    if payload.ref:
        inviter = await users_crud.get_user_by_ref_code(db, payload.ref.strip().upper())
        if inviter:
            referred_by = inviter.ref_code
    await auth_codes_crud.upsert_pending(
        db,
        nickname=payload.nickname,
        first_name=payload.first_name,
        last_name=payload.last_name,
        password_hash=await hash_password_async(payload.password),
        referred_by=referred_by,
    )
    await db.commit()
    return RegisterInitResponse(
        nickname=payload.nickname,
        bot_username=settings.BOT_USERNAME,
        channel=settings.TELEGRAM_CHANNEL,
    )


@router.post("/code-status", response_model=CodeStatusResponse)
@limiter.limit("30/minute")
async def code_status(
    request: Request, payload: CodeStatusRequest, db: AsyncSession = Depends(get_db)
):
    """Saytdagi teskari sanoq uchun: amaldagi kod bor-yo'qligi va tugash vaqti."""
    code = await auth_codes_crud.get_active_code(db, payload.nickname)
    if code is None:
        return CodeStatusResponse(active=False)
    exp = code.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    remaining = int((exp - datetime.now(timezone.utc)).total_seconds())
    return CodeStatusResponse(
        active=True, remaining_seconds=max(0, remaining), purpose=code.purpose
    )


@router.post(
    "/verify-code", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("10/minute")
async def verify_code(
    request: Request, payload: VerifyCodeRequest, db: AsyncSession = Depends(get_db)
):
    """2-qadam: Telegram'dan kelgan kod tasdiqlanadi -> profil ochiladi."""
    code = await auth_codes_crud.get_valid_code(
        db, payload.nickname, payload.code, purpose="register"
    )
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kod noto'g'ri yoki muddati tugagan",
        )
    pending = await auth_codes_crud.get_pending(db, payload.nickname)
    if pending is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ro'yxat ma'lumoti topilmadi, qaytadan urinib ko'ring",
        )
    if await users_crud.get_user_by_nickname(db, pending.nickname_display):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Bu nik allaqachon band"
        )
    # Bir Telegram = bir nik: bu telegram allaqachon boshqa akkauntga bog'langan bo'lsa — rad
    if code.telegram_id:
        bound = await users_crud.get_user_by_telegram_id(db, code.telegram_id)
        if bound is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Bu Telegram akkaunt allaqachon «{bound.nickname}» nikiga bog'langan",
            )
    user = await users_crud.create_user(
        db,
        name=pending.first_name,
        surname=pending.last_name,
        nickname=pending.nickname_display,
        phone=f"nick:{pending.nickname}",
        password_hash=pending.password_hash,
        referred_by=pending.referred_by,
    )
    # Telegram akkauntni shu nikka bog'laymiz
    user.telegram_id = code.telegram_id
    if pending.referred_by:
        inviter = await users_crud.get_user_by_ref_code(db, pending.referred_by)
        if inviter:
            # Promokod bilan ro'yxatdan o'tishda — egasiga admin belgilagan bonus.
            settings_row = await settings_crud.get_settings(db)
            bonus = int(settings_row.referral_bonus or 0)
            await users_crud.create_referral(
                db, referrer_id=inviter.id, referred_user_id=user.id, bonus=bonus
            )
            if bonus:
                inviter.bonus_balance = int(inviter.bonus_balance or 0) + bonus
    await auth_codes_crud.consume_code(db, code)
    await auth_codes_crud.delete_pending(db, payload.nickname)
    try:
        await db.commit()
    except IntegrityError:
        # Konkurent so'rov shu nik yoki Telegram'ni allaqachon band qilgan.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu nik yoki Telegram akkaunt allaqachon band. Qaytadan urinib ko'ring.",
        )
    return _tokens(user)


@router.post("/forgot-init", response_model=RegisterInitResponse)
@limiter.limit("5/minute")
async def forgot_init(
    request: Request, payload: CodeStatusRequest, db: AsyncSession = Depends(get_db)
):
    """Parolni tiklash 1-qadami: nik mavjudligini tekshiradi, bot ma'lumotini qaytaradi."""
    user = await users_crud.get_user_by_nickname(db, payload.nickname)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bunday nik topilmadi",
        )
    return RegisterInitResponse(
        nickname=payload.nickname,
        bot_username=settings.BOT_USERNAME,
        channel=settings.TELEGRAM_CHANNEL,
    )


@router.post("/verify-reset", response_model=OkResponse)
@limiter.limit("10/minute")
async def verify_reset(
    request: Request, payload: VerifyCodeRequest, db: AsyncSession = Depends(get_db)
):
    """Parolni tiklash kodini tekshiradi (hali ishlatmaydi — yangi parol bosqichigacha)."""
    code = await auth_codes_crud.get_valid_code(
        db, payload.nickname, payload.code, purpose="reset"
    )
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kod noto'g'ri yoki muddati tugagan",
        )
    return OkResponse()


@router.post("/reset-password", response_model=TokenResponse)
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset kodi qayta tekshiriladi -> yangi parol o'rnatiladi (avto-login)."""
    err = password_error(payload.new_password)
    if err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    code = await auth_codes_crud.get_valid_code(
        db, payload.nickname, payload.code, purpose="reset"
    )
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kod noto'g'ri yoki muddati tugagan",
        )
    user = await users_crud.get_user_by_nickname(db, payload.nickname)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Foydalanuvchi topilmadi"
        )
    user.password_hash = await hash_password_async(payload.new_password)
    # Eski (bog'lanmagan) user uchun: shu telegramni nikka bog'lab qo'yamiz
    if not user.telegram_id and code.telegram_id:
        user.telegram_id = code.telegram_id
    await auth_codes_crud.consume_code(db, code)
    await db.commit()
    return _tokens(user)


@router.post("/delete-account", response_model=OkResponse)
@limiter.limit("10/minute")
async def delete_account(
    request: Request, payload: VerifyCodeRequest, db: AsyncSession = Depends(get_db)
):
    """Telegram kodi bilan tasdiqlab, akkauntni BUTUNLAY o'chiradi (ortga qaytmaydi).

    FK cascade: imtihon/xato/sevimli/obuna/referal/kirish ham o'chadi; to'lovlar saqlanadi (user_id=NULL).
    """
    code = await auth_codes_crud.get_valid_code(
        db, payload.nickname, payload.code, purpose="reset"
    )
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kod noto'g'ri yoki muddati tugagan",
        )
    user = await users_crud.get_user_by_nickname(db, payload.nickname)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Foydalanuvchi topilmadi"
        )
    # Akkauntni o'chiramiz — telegram_id User ustunida edi, demak Telegram bog'lanishi
    # ham uziladi (shu telegram boshqa nikka qayta bog'lanishi mumkin bo'ladi).
    await db.delete(user)
    # Tozalash: nikka tegishli pending + barcha tasdiq kodlari
    await auth_codes_crud.delete_pending(db, payload.nickname)
    await auth_codes_crud.delete_codes_for_nickname(db, payload.nickname)
    await db.commit()
    return OkResponse()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)
):
    # Kirishda nik ro'yxatdagidek ANIQ (katta-kichik harf bilan) yozilishi shart
    user = await users_crud.get_user_by_nickname_exact(db, payload.nickname)
    if user is None:
        # BITTA UMUMIY LOGIN: admin hisoblari nickname'ga ega emas (login ularda
        # `phone` ustunida saqlanadi) — shu yerdan ham kira olishlari uchun fallback.
        # Faqat role=admin uchun ishlaydi — oddiy foydalanuvchining sintetik
        # `phone` qiymati (nick:xxx) bilan tasodifiy to'qnashuv xavfsiz emas.
        candidate = await users_crud.get_user_by_phone(db, payload.nickname)
        if candidate is not None and candidate.role == Role.admin:
            user = candidate
    if user is None or not await verify_password_async(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nik yoki parol noto'g'ri",
        )
    if user.is_blocked:
        await users_crud.auto_unblock_if_expired(db, user)
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=user.block_reason
            or "Akkaunt bloklangan. Administrator bilan bog'laning.",
        )
    return _tokens(user)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh(
    request: Request, payload: RefreshRequest, db: AsyncSession = Depends(get_db)
):
    data = decode_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Yaroqsiz refresh token"
        )
    user = await users_crud.get_user_by_id(db, data.get("sub"))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Foydalanuvchi topilmadi"
        )
    # Bloklangan akkaunt refresh orqali yangi token OLMASLIGI kerak (get_current_user
    # bilan bir xil mantiq) — muddat tugagan bo'lsa avto-ochiladi, aks holda 403.
    if user.is_blocked:
        await users_crud.auto_unblock_if_expired(db, user)
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=user.block_reason
            or "Akkaunt bloklangan. Administrator bilan bog'laning.",
        )
    return _tokens(user)


@router.get("/me", response_model=UserRead)
async def get_me(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    sub = await users_crud.get_active_subscription(db, user.id)
    return serialize_user(
        user,
        subscription_active=sub is not None,
        subscription_expires_at=sub.expires_at if sub else None,
    )


@router.patch("/me", response_model=UserRead)
async def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    for field in ("name", "surname", "email", "telegram", "avatar_url"):
        if field in data and data[field] is not None:
            setattr(user, field, data[field])
    await db.commit()
    sub = await users_crud.get_active_subscription(db, user.id)
    return serialize_user(
        user,
        subscription_active=sub is not None,
        subscription_expires_at=sub.expires_at if sub else None,
    )


@router.post("/change-password", response_model=OkResponse)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kirgan foydalanuvchi parolini o'zgartiradi (joriy parolni tasdiqlab)."""
    if not await verify_password_async(payload.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Joriy parol noto'g'ri"
        )
    err = password_error(payload.new_password)
    if err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    user.password_hash = await hash_password_async(payload.new_password)
    await db.commit()
    return OkResponse()


@admin_router.get("/me", response_model=AdminCredentialsResponse)
async def get_admin_me(admin: User = Depends(get_current_admin)):
    """Joriy adminning o'z login(i)ni qaytaradi — frontend admin-token bilan chaqiradi.

    /auth/me dan FARQLI: bu /admin/ prefiksli, shuning uchun frontend interceptor
    admin tokenini yuboradi (/auth/me esa oddiy user tokenini yuborar edi).
    """
    return AdminCredentialsResponse(ok=True, login=admin.phone)


@admin_router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def admin_login(
    request: Request, payload: AdminLoginRequest, db: AsyncSession = Depends(get_db)
):
    user = await users_crud.get_user_by_phone(db, payload.login)
    if (
        user is None
        or user.role != Role.admin
        or not await verify_password_async(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Login yoki parol noto'g'ri"
        )
    return _tokens(user)


# Login `phone` ustunida saqlanadi — tarixan telefon raqami formatida bo'lgan
# ("+998 90 123 45 67" kabi), shuning uchun harf/raqamdan tashqari +, -, bo'sh joy,
# ._ @ kabi keng tarqalgan belgilarga ham ruxsat beramiz. Faqat boshqaruv belgilari
# (\n, \t va h.k.) va bo'sh/juda uzun qiymat rad etiladi.
_ADMIN_LOGIN_RE = re.compile(r"^[!-~ ]{3,32}$")


@admin_router.patch("/credentials", response_model=AdminCredentialsResponse)
async def update_admin_credentials(
    payload: AdminUpdateCredentialsRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin o'z login/parolini o'zgartiradi — faqat shu admin hisobiga tegadi."""
    if not await verify_password_async(payload.current_password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Joriy parol noto'g'ri"
        )

    new_login = (payload.new_login or "").strip()
    new_password = payload.new_password or ""
    if not new_login and not new_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Yangi login yoki yangi parol kiritilishi kerak",
        )

    if new_login and new_login != admin.phone:
        if not _ADMIN_LOGIN_RE.match(new_login):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Login 3-32 belgidan iborat bo'lishi kerak (tab/qator ko'chirish belgilarisiz)",
            )
        existing = await users_crud.get_user_by_phone(db, new_login)
        if existing is not None and existing.id != admin.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Bu login band"
            )
        admin.phone = new_login

    if new_password:
        err = password_error(new_password)
        if err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err
            )
        admin.password_hash = await hash_password_async(new_password)

    await db.commit()
    return AdminCredentialsResponse(ok=True, login=admin.phone)
