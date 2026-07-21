"""Ustoz (maslahat) tizimi routelari.

- user_router    — foydalanuvchi: ustozlar ro'yxati, sotib olish, chat
- teacher_router — ustoz paneli: navbatli suhbatlar, javob, login o'zgartirish
- admin_router   — admin: ustoz CRUD, tariflar, chat moderatsiyasi, ogohlantirishlar
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ratelimit import limiter, questions_key
from app.core.security import hash_password_async, verify_password_async
from app.crud import teachers as teachers_crud
from app.db.session import get_db
from app.deps import get_current_admin, get_current_teacher, get_current_user
from app.models.enums import PaymentStatus, Role
from app.models.tariff import Payment
from app.models.teacher import (
    ChatMessage,
    ChatThread,
    TeacherAccess,
    TeacherProfile,
    TeacherTariff,
)
from app.models.user import User
from app.schemas.teacher import (
    AdminChatMessageRead,
    AdminFlaggedMessage,
    AdminThreadRead,
    ChatEditRequest,
    ChatMessageRead,
    ChatSendRequest,
    ChatUploadResponse,
    TeacherAdminRead,
    TeacherChangeLoginRequest,
    TeacherCreate,
    TeacherPublic,
    TeacherPurchaseRequest,
    TeacherPurchaseResponse,
    TeacherTariffCreate,
    TeacherTariffRead,
    TeacherThreadRead,
    TeacherUpdate,
)
from app.services.uploads import save_chat_attachment

user_router = APIRouter(tags=["teachers"])
teacher_router = APIRouter(prefix="/teacher", tags=["teacher-panel"])
admin_router = APIRouter(prefix="/admin", tags=["admin-teachers"])


def _tariffs(profile: TeacherProfile) -> list[TeacherTariffRead]:
    return [
        TeacherTariffRead.model_validate(t)
        for t in profile.tariffs
        if t.is_active
    ]


def _msg(m: ChatMessage) -> ChatMessageRead:
    return ChatMessageRead.model_validate(m)


# ================= USER =================
@user_router.get("/teachers", response_model=list[TeacherPublic])
async def list_teachers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Faol ustozlar — ism, familiya, tajriba, tariflar + joriy user kirishi."""
    rows = await teachers_crud.list_active_teachers(db)
    out: list[TeacherPublic] = []
    for profile, tuser in rows:
        access = await teachers_crud.get_active_access(db, user.id, profile.id)
        thread = await teachers_crud.find_thread(
            db, user_id=user.id, teacher_id=profile.id
        )
        out.append(
            TeacherPublic(
                id=profile.id,
                name=tuser.name,
                surname=tuser.surname,
                experience_years=profile.experience_years,
                tariffs=_tariffs(profile),
                has_access=access is not None,
                access_expires_at=access.expires_at if access else None,
                thread_awaiting_reply=thread.awaiting_reply if thread else None,
                thread_last_msg_at=thread.last_msg_at if thread else None,
            )
        )
    return out


@user_router.post(
    "/teachers/{teacher_id}/purchase",
    response_model=TeacherPurchaseResponse,
    status_code=201,
)
async def purchase_teacher_access(
    teacher_id: str,
    payload: TeacherPurchaseRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Ustozga murojaat kirishini sotib olish (real-exam kabi darhol ochiladi)."""
    profile = await teachers_crud.get_teacher(db, teacher_id)
    if profile is None or not profile.is_active:
        raise HTTPException(status_code=404, detail="Ustoz topilmadi")
    tariff = await teachers_crud.get_tariff(db, payload.tariff_id)
    if tariff is None or tariff.teacher_id != teacher_id or not tariff.is_active:
        raise HTTPException(status_code=404, detail="Tarif topilmadi")

    access = await teachers_crud.grant_access(
        db, user_id=user.id, teacher_id=teacher_id, days=tariff.days
    )
    # Daromad hisobida ko'rinishi uchun to'lov yozuvi (haqiqiy shlyuz keyin ulanadi).
    # category="teacher" -> dashboard buni real imtihon daromadidan ajratadi.
    db.add(
        Payment(
            user_id=user.id,
            tariff_id=None,
            method=payload.method or "demo",
            phone=user.phone,
            amount=tariff.price,
            category="teacher",
            status=PaymentStatus.paid,
        )
    )
    await db.commit()
    return TeacherPurchaseResponse(ok=True, expires_at=access.expires_at)


@user_router.get("/teachers/{teacher_id}/chat")
async def get_teacher_chat(
    teacher_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Chat tarixi. O'qish — muddat tugagach ham mumkin; yozish — faqat aktiv kirishda."""
    profile = await teachers_crud.get_teacher(db, teacher_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Ustoz topilmadi")
    access = await teachers_crud.get_active_access(db, user.id, teacher_id)
    thread = await teachers_crud.get_or_create_thread(
        db, user_id=user.id, teacher_id=teacher_id
    )
    messages = await teachers_crud.list_messages(db, thread.id)
    await db.commit()
    return {
        "threadId": thread.id,
        "canSend": access is not None,
        "accessExpiresAt": access.expires_at.isoformat() if access else None,
        "messages": [_msg(m).model_dump(by_alias=True) for m in messages],
    }


@user_router.post("/teachers/{teacher_id}/chat", response_model=ChatMessageRead)
@limiter.limit("30/minute", key_func=questions_key)
async def send_to_teacher(
    request: Request,
    teacher_id: str,
    payload: ChatSendRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not payload.text and not payload.attachment_url:
        raise HTTPException(status_code=400, detail="Xabar bo'sh bo'lmasin")
    profile = await teachers_crud.get_teacher(db, teacher_id)
    if profile is None or not profile.is_active:
        raise HTTPException(status_code=404, detail="Ustoz topilmadi")
    access = await teachers_crud.get_active_access(db, user.id, teacher_id)
    if access is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ustozga yozish uchun tarif sotib oling",
            headers={"X-Content-Gate": "teacher"},
        )
    thread = await teachers_crud.get_or_create_thread(
        db, user_id=user.id, teacher_id=teacher_id
    )
    msg = await teachers_crud.add_message(
        db,
        thread,
        sender="user",
        text=payload.text,
        attachment_url=payload.attachment_url,
        attachment_name=payload.attachment_name,
        attachment_type=payload.attachment_type,
    )
    await db.commit()
    return _msg(msg)


async def _own_user_message(
    db: AsyncSession, *, teacher_id: str, message_id: str, user: User
):
    """User o'z suhbatidagi O'ZI yozgan xabarini oladi (tahrir/o'chirish uchun)."""
    msg = await teachers_crud.get_message(db, message_id)
    if msg is None or msg.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Xabar topilmadi")
    thread = await teachers_crud.get_thread(db, msg.thread_id)
    if (
        thread is None
        or thread.user_id != user.id
        or thread.teacher_id != teacher_id
        or msg.sender != "user"
    ):
        raise HTTPException(status_code=404, detail="Xabar topilmadi")
    return msg


@user_router.patch(
    "/teachers/{teacher_id}/chat/{message_id}", response_model=ChatMessageRead
)
async def edit_user_message(
    teacher_id: str,
    message_id: str,
    payload: ChatEditRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """O'z xabarini tahrirlash (telegram kabi — faqat o'ziniki)."""
    msg = await _own_user_message(
        db, teacher_id=teacher_id, message_id=message_id, user=user
    )
    await teachers_crud.edit_message(db, msg, text=payload.text)
    await db.commit()
    return _msg(msg)


@user_router.delete(
    "/teachers/{teacher_id}/chat/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_user_message(
    teacher_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """O'z xabarini o'chirish (soft — admin moderatsiyada ko'raveradi)."""
    msg = await _own_user_message(
        db, teacher_id=teacher_id, message_id=message_id, user=user
    )
    await teachers_crud.soft_delete_message(db, msg)
    await db.commit()


@user_router.post("/chat-upload", response_model=ChatUploadResponse)
@limiter.limit("15/minute", key_func=questions_key)
async def upload_chat_attachment(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Chat biriktirmasi (rasm/hujjat) — user ham, ustoz ham ishlatadi."""
    url, name, type_ = await save_chat_attachment(file)
    return ChatUploadResponse(url=url, name=name, type=type_)


# ================= TEACHER PANEL =================
async def _own_profile(db: AsyncSession, teacher: User) -> TeacherProfile:
    profile = await teachers_crud.get_profile_by_user(db, teacher.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Ustoz profili topilmadi")
    return profile


@teacher_router.get("/threads", response_model=list[TeacherThreadRead])
async def teacher_threads(
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
):
    """Suhbatlar navbati: javob kutayotganlar tepada (eng eski birinchi)."""
    profile = await _own_profile(db, teacher)
    rows = await teachers_crud.teacher_threads_queue(db, profile.id)
    out = []
    for thread, tuser in rows:
        out.append(
            TeacherThreadRead(
                id=thread.id,
                user_name=f"{tuser.name} {tuser.surname or ''}".strip(),
                user_nickname=tuser.nickname,
                awaiting_reply=thread.awaiting_reply,
                last_msg_at=thread.last_msg_at,
                last_text=await teachers_crud.last_message_text(db, thread.id),
            )
        )
    return out


@teacher_router.get(
    "/threads/{thread_id}/messages", response_model=list[ChatMessageRead]
)
async def teacher_thread_messages(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
):
    profile = await _own_profile(db, teacher)
    thread = await teachers_crud.get_thread(db, thread_id)
    if thread is None or thread.teacher_id != profile.id:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")
    return [_msg(m) for m in await teachers_crud.list_messages(db, thread_id)]


@teacher_router.post(
    "/threads/{thread_id}/messages", response_model=ChatMessageRead
)
@limiter.limit("30/minute", key_func=questions_key)
async def teacher_reply(
    request: Request,
    thread_id: str,
    payload: ChatSendRequest,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
):
    if not payload.text and not payload.attachment_url:
        raise HTTPException(status_code=400, detail="Xabar bo'sh bo'lmasin")
    profile = await _own_profile(db, teacher)
    thread = await teachers_crud.get_thread(db, thread_id)
    if thread is None or thread.teacher_id != profile.id:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")
    msg = await teachers_crud.add_message(
        db,
        thread,
        sender="teacher",
        text=payload.text,
        attachment_url=payload.attachment_url,
        attachment_name=payload.attachment_name,
        attachment_type=payload.attachment_type,
    )
    await db.commit()
    return _msg(msg)


async def _own_teacher_message(
    db: AsyncSession, *, thread_id: str, message_id: str, teacher: User
):
    profile = await _own_profile(db, teacher)
    msg = await teachers_crud.get_message(db, message_id)
    if msg is None or msg.deleted_at is not None or msg.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="Xabar topilmadi")
    thread = await teachers_crud.get_thread(db, thread_id)
    if thread is None or thread.teacher_id != profile.id or msg.sender != "teacher":
        raise HTTPException(status_code=404, detail="Xabar topilmadi")
    return msg


@teacher_router.patch(
    "/threads/{thread_id}/messages/{message_id}", response_model=ChatMessageRead
)
async def teacher_edit_message(
    thread_id: str,
    message_id: str,
    payload: ChatEditRequest,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
):
    msg = await _own_teacher_message(
        db, thread_id=thread_id, message_id=message_id, teacher=teacher
    )
    await teachers_crud.edit_message(db, msg, text=payload.text)
    await db.commit()
    return _msg(msg)


@teacher_router.delete(
    "/threads/{thread_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def teacher_delete_message(
    thread_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
):
    msg = await _own_teacher_message(
        db, thread_id=thread_id, message_id=message_id, teacher=teacher
    )
    await teachers_crud.soft_delete_message(db, msg)
    await db.commit()


@teacher_router.post("/change-login")
async def teacher_change_login(
    payload: TeacherChangeLoginRequest,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
):
    """Loginni (nikni) o'zgartirish — joriy parol bilan tasdiqlanadi."""
    if not await verify_password_async(payload.password, teacher.password_hash):
        raise HTTPException(status_code=400, detail="Parol noto'g'ri")
    if not payload.new_login.isalnum():
        raise HTTPException(
            status_code=400, detail="Login faqat lotin harf va raqamlardan iborat bo'lsin"
        )
    exists = await db.execute(
        select(User).where(User.nickname == payload.new_login, User.id != teacher.id)
    )
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Bu login allaqachon band")
    teacher.nickname = payload.new_login
    await db.commit()
    return {"ok": True, "login": teacher.nickname}


# ================= ADMIN =================
def _admin_teacher(profile: TeacherProfile, tuser: User) -> TeacherAdminRead:
    return TeacherAdminRead(
        id=profile.id,
        user_id=tuser.id,
        name=tuser.name,
        surname=tuser.surname,
        phone=tuser.phone,
        telegram=tuser.telegram,
        nickname=tuser.nickname,
        experience_years=profile.experience_years,
        is_active=profile.is_active,
        created_at=profile.created_at,
        tariffs=[TeacherTariffRead.model_validate(t) for t in profile.tariffs],
    )


@admin_router.get("/teachers", response_model=list[TeacherAdminRead])
async def admin_list_teachers(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    rows = await teachers_crud.list_all_teachers(db)
    return [_admin_teacher(p, u) for p, u in rows]


@admin_router.post(
    "/teachers", response_model=TeacherAdminRead, status_code=status.HTTP_201_CREATED
)
async def admin_create_teacher(
    payload: TeacherCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Yangi ustoz: ism, familiya, telefon, telegram, tajriba + login/parol (x2)."""
    if payload.password != payload.password_confirm:
        raise HTTPException(status_code=400, detail="Parollar mos kelmaydi")
    nick_taken = await db.execute(
        select(User).where(User.nickname == payload.login)
    )
    if nick_taken.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Bu login allaqachon band")
    phone_taken = await db.execute(select(User).where(User.phone == payload.phone))
    if phone_taken.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409, detail="Bu telefon raqam allaqachon ro'yxatda bor"
        )

    tuser = User(
        name=payload.name,
        surname=payload.surname,
        nickname=payload.login,
        phone=payload.phone,
        telegram=payload.telegram,
        password_hash=await hash_password_async(payload.password),
        role=Role.teacher,
    )
    db.add(tuser)
    await db.flush()
    profile = TeacherProfile(
        user_id=tuser.id, experience_years=payload.experience_years
    )
    db.add(profile)
    await db.flush()
    await db.commit()
    fresh = await teachers_crud.get_teacher(db, profile.id)
    return _admin_teacher(fresh, tuser)


@admin_router.patch("/teachers/{teacher_id}", response_model=TeacherAdminRead)
async def admin_update_teacher(
    teacher_id: str,
    payload: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    profile = await teachers_crud.get_teacher(db, teacher_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Ustoz topilmadi")
    tuser = await db.get(User, profile.user_id)
    data = payload.model_dump(exclude_unset=True)
    if "experience_years" in data and data["experience_years"] is not None:
        profile.experience_years = data["experience_years"]
    if "is_active" in data and data["is_active"] is not None:
        profile.is_active = data["is_active"]
    for field in ("name", "surname", "phone", "telegram"):
        if data.get(field) is not None:
            setattr(tuser, field, data[field])
    await db.commit()
    fresh = await teachers_crud.get_teacher(db, teacher_id)
    return _admin_teacher(fresh, tuser)


@admin_router.delete(
    "/teachers/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def admin_delete_teacher(
    teacher_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Ustozni dasturdan chiqarish — profili, suhbatlari va akkaunti o'chadi."""
    profile = await teachers_crud.get_teacher(db, teacher_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Ustoz topilmadi")
    # SQLite'da FK-kaskadga tayanmaymiz — bog'liq yozuvlarni aniq o'chiramiz
    thread_ids = select(ChatThread.id).where(ChatThread.teacher_id == teacher_id)
    await db.execute(delete(ChatMessage).where(ChatMessage.thread_id.in_(thread_ids)))
    await db.execute(delete(ChatThread).where(ChatThread.teacher_id == teacher_id))
    await db.execute(
        delete(TeacherAccess).where(TeacherAccess.teacher_id == teacher_id)
    )
    await db.execute(
        delete(TeacherTariff).where(TeacherTariff.teacher_id == teacher_id)
    )
    tuser = await db.get(User, profile.user_id)
    await db.delete(profile)
    if tuser is not None:
        await db.delete(tuser)
    await db.commit()


@admin_router.post(
    "/teachers/{teacher_id}/tariffs",
    response_model=TeacherTariffRead,
    status_code=201,
)
async def admin_add_teacher_tariff(
    teacher_id: str,
    payload: TeacherTariffCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Ustozga tarif: N kun = X so'm (tajribaga qarab har xil narx qo'yiladi)."""
    profile = await teachers_crud.get_teacher(db, teacher_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Ustoz topilmadi")
    tariff = TeacherTariff(
        teacher_id=teacher_id, days=payload.days, price=payload.price
    )
    db.add(tariff)
    await db.commit()
    return TeacherTariffRead.model_validate(tariff)


@admin_router.delete(
    "/teachers/{teacher_id}/tariffs/{tariff_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def admin_delete_teacher_tariff(
    teacher_id: str,
    tariff_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    tariff = await teachers_crud.get_tariff(db, tariff_id)
    if tariff is None or tariff.teacher_id != teacher_id:
        raise HTTPException(status_code=404, detail="Tarif topilmadi")
    await db.delete(tariff)
    await db.commit()


@admin_router.get("/teacher-chats", response_model=list[AdminThreadRead])
async def admin_teacher_chats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Barcha user↔ustoz suhbatlari (telegram kabi ro'yxat)."""
    rows = await teachers_crud.all_threads(db)
    out = []
    for thread, tuser, teacher_user in rows:
        out.append(
            AdminThreadRead(
                id=thread.id,
                user_name=f"{tuser.name} {tuser.surname or ''}".strip(),
                user_nickname=tuser.nickname,
                teacher_name=(
                    f"{teacher_user.name} {teacher_user.surname or ''}".strip()
                    if teacher_user
                    else "?"
                ),
                last_msg_at=thread.last_msg_at,
                last_text=await teachers_crud.last_message_text(db, thread.id),
                flagged_count=await teachers_crud.flagged_count_for_thread(
                    db, thread.id
                ),
            )
        )
    return out


@admin_router.get(
    "/teacher-chats/{thread_id}", response_model=list[AdminChatMessageRead]
)
async def admin_teacher_chat_messages(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """To'liq yozishma — o'chirilgan xabarlar ham (moderatsiya dalili)."""
    thread = await teachers_crud.get_thread(db, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")
    messages = await teachers_crud.list_messages(
        db, thread_id, limit=500, include_deleted=True
    )
    return [AdminChatMessageRead.model_validate(m) for m in messages]


@admin_router.get("/teacher-flags", response_model=list[AdminFlaggedMessage])
async def admin_teacher_flags(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Shubhali xabarlar (link/fayl/rasm) — kim yuborgani bilan."""
    rows = await teachers_crud.flagged_messages(db)
    out = []
    for msg, thread in rows:
        if msg.sender == "user":
            sender_user = await db.get(User, thread.user_id)
        else:
            profile = await db.get(TeacherProfile, thread.teacher_id)
            sender_user = (
                await db.get(User, profile.user_id) if profile else None
            )
        out.append(
            AdminFlaggedMessage(
                id=msg.id,
                thread_id=msg.thread_id,
                sender=msg.sender,
                sender_name=(
                    f"{sender_user.name} {sender_user.surname or ''}".strip()
                    if sender_user
                    else "?"
                ),
                text=msg.text,
                attachment_url=msg.attachment_url,
                attachment_name=msg.attachment_name,
                attachment_type=msg.attachment_type,
                has_link=msg.has_link,
                has_phone=msg.has_phone,
                created_at=msg.created_at,
            )
        )
    return out


@admin_router.delete(
    "/teacher-flags/{message_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def admin_dismiss_flag(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Ogohlantirishni o'chirish (admin ko'rib chiqdi) — flag olib tashlanadi,
    xabar suhbatda qoladi, warnings ro'yxatidan yo'qoladi."""
    msg = await teachers_crud.get_message(db, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="Xabar topilmadi")
    await teachers_crud.dismiss_flag(db, msg)
    await db.commit()
