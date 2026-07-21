"""Ustoz tizimi repozitoriysi: profillar, tariflar, kirish, chat navbati."""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.teacher import (
    ChatMessage,
    ChatThread,
    TeacherAccess,
    TeacherProfile,
    TeacherTariff,
)
from app.models.user import User

# Matndagi havolani aniqlash (shubhali kontent belgisi uchun)
_LINK_RE = re.compile(r"(https?://|www\.|t\.me/|@[A-Za-z0-9_]{4,})", re.IGNORECASE)

# Telefon nomzod tokeni — ixtiyoriy '+' va raqamdan boshlanib, raqam/ajratgich (bo'sh
# joy, tire, nuqta, qavs) ketma-ketligi, raqam bilan tugaydi. GURUHLASHGA bog'liq emas
# (2-3-2-2, 3-3-3, ajratgichsiz — barchasi ushlanadi). Nomzoddagi raqam soni keyin sanaladi.
_PHONE_CANDIDATE_RE = re.compile(r"(?<![\d+])\+?\d[\d\s\-.()]{6,}\d(?!\d)")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def has_link(text: Optional[str]) -> bool:
    return bool(text and _LINK_RE.search(text))


def has_phone(text: Optional[str]) -> bool:
    """Matnda O'zbekiston telefon raqami bor-yo'qligi (guruhlashdan mustaqil).

    Nomzod tokenidagi raqamlar soni 9 (lokal) yoki 12 (998 bilan) bo'lsa — raqam.
    Sana/narx noto'g'ri musbat bermaydi (10 raqamli sana yoki qisqa narx mos kelmaydi).
    """
    if not text:
        return False
    for m in _PHONE_CANDIDATE_RE.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) == 9 or (len(digits) == 12 and digits.startswith("998")):
            return True
    return False


# ---------------- Profiles ----------------
async def list_active_teachers(db: AsyncSession) -> list[tuple[TeacherProfile, User]]:
    res = await db.execute(
        select(TeacherProfile, User)
        .join(User, User.id == TeacherProfile.user_id)
        .where(TeacherProfile.is_active.is_(True), User.is_blocked.is_(False))
        .options(selectinload(TeacherProfile.tariffs))
        .order_by(TeacherProfile.experience_years.desc())
    )
    return [(tp, u) for tp, u in res.all()]


async def list_all_teachers(db: AsyncSession) -> list[tuple[TeacherProfile, User]]:
    res = await db.execute(
        select(TeacherProfile, User)
        .join(User, User.id == TeacherProfile.user_id)
        .options(selectinload(TeacherProfile.tariffs))
        .order_by(TeacherProfile.created_at.desc())
    )
    return [(tp, u) for tp, u in res.all()]


async def get_teacher(db: AsyncSession, teacher_id: str) -> Optional[TeacherProfile]:
    res = await db.execute(
        select(TeacherProfile)
        .where(TeacherProfile.id == teacher_id)
        .options(selectinload(TeacherProfile.tariffs))
    )
    return res.scalar_one_or_none()


async def get_profile_by_user(
    db: AsyncSession, user_id: str
) -> Optional[TeacherProfile]:
    res = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == user_id)
    )
    return res.scalar_one_or_none()


# ---------------- Tariffs ----------------
async def get_tariff(db: AsyncSession, tariff_id: str) -> Optional[TeacherTariff]:
    return await db.get(TeacherTariff, tariff_id)


# ---------------- Access ----------------
async def get_active_access(
    db: AsyncSession, user_id: str, teacher_id: str
) -> Optional[TeacherAccess]:
    res = await db.execute(
        select(TeacherAccess)
        .where(
            TeacherAccess.user_id == user_id,
            TeacherAccess.teacher_id == teacher_id,
            TeacherAccess.expires_at > _now(),
        )
        .order_by(TeacherAccess.expires_at.desc())
        .limit(1)
    )
    return res.scalar_one_or_none()


async def grant_access(
    db: AsyncSession, *, user_id: str, teacher_id: str, days: int
) -> TeacherAccess:
    """Kirish beradi; aktiv kirish bo'lsa muddat USTIGA qo'shiladi."""
    existing = await get_active_access(db, user_id, teacher_id)
    if existing:
        existing.expires_at = existing.expires_at + timedelta(days=days)
        await db.flush()
        return existing
    access = TeacherAccess(
        user_id=user_id, teacher_id=teacher_id,
        expires_at=_now() + timedelta(days=days),
    )
    db.add(access)
    await db.flush()
    return access


# ---------------- Threads ----------------
async def find_thread(
    db: AsyncSession, *, user_id: str, teacher_id: str
) -> Optional[ChatThread]:
    """Mavjud bo'lsagina thread qaytaradi (YARATMAYDI) — ustozlar ro'yxatida
    bildirishnoma holatini (awaiting_reply/last_msg_at) ko'rsatish uchun."""
    res = await db.execute(
        select(ChatThread).where(
            ChatThread.user_id == user_id, ChatThread.teacher_id == teacher_id
        )
    )
    return res.scalar_one_or_none()


async def get_or_create_thread(
    db: AsyncSession, *, user_id: str, teacher_id: str
) -> ChatThread:
    res = await db.execute(
        select(ChatThread).where(
            ChatThread.user_id == user_id, ChatThread.teacher_id == teacher_id
        )
    )
    thread = res.scalar_one_or_none()
    if thread is None:
        thread = ChatThread(user_id=user_id, teacher_id=teacher_id)
        db.add(thread)
        await db.flush()
    return thread


async def teacher_threads_queue(
    db: AsyncSession, teacher_id: str
) -> list[tuple[ChatThread, User]]:
    """Navbat: javob kutayotganlar (eng eski birinchi), keyin javob berilganlar."""
    res = await db.execute(
        select(ChatThread, User)
        .join(User, User.id == ChatThread.user_id)
        .where(ChatThread.teacher_id == teacher_id)
        .order_by(
            ChatThread.awaiting_reply.desc(),
            # kutayotganlar orasida eng eski birinchi; qolganlari oxirgi xabar bo'yicha
            func.coalesce(ChatThread.awaiting_since, ChatThread.last_msg_at).asc(),
        )
    )
    rows = [(t, u) for t, u in res.all()]
    # Javob berilganlar (awaiting=False) — oxirgi faollik bo'yicha teskari (yangi pastda emas,
    # tepada bo'lishi tabiiyroq): kutayotganlar tepada eski→yangi, qolganlar yangi→eski.
    waiting = [r for r in rows if r[0].awaiting_reply]
    done = sorted(
        (r for r in rows if not r[0].awaiting_reply),
        key=lambda r: r[0].last_msg_at or r[0].created_at,
        reverse=True,
    )
    return waiting + done


async def get_thread(db: AsyncSession, thread_id: str) -> Optional[ChatThread]:
    return await db.get(ChatThread, thread_id)


# ---------------- Messages ----------------
async def list_messages(
    db: AsyncSession,
    thread_id: str,
    *,
    limit: int = 200,
    include_deleted: bool = False,
) -> list[ChatMessage]:
    stmt = select(ChatMessage).where(ChatMessage.thread_id == thread_id)
    if not include_deleted:
        stmt = stmt.where(ChatMessage.deleted_at.is_(None))
    # Eng YANGI `limit` ta xabarni olamiz (desc + limit), so'ng ekranda eski->yangi
    # tartibda ko'rsatish uchun teskari qilamiz. Avval asc().limit() ishlatilardi —
    # bu ENG ESKI `limit` tani olardi, ya'ni suhbat `limit` dan oshsa foydalanuvchi
    # YANGI xabarlarni umuman ko'rmasdi (faol chatда jiddiy nuqson).
    res = await db.execute(
        stmt.order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(limit)
    )
    rows = list(res.scalars().all())
    rows.reverse()
    return rows


async def get_message(db: AsyncSession, message_id: str) -> Optional[ChatMessage]:
    return await db.get(ChatMessage, message_id)


async def edit_message(db: AsyncSession, msg: ChatMessage, *, text: str) -> ChatMessage:
    """Xabar matnini yangilaydi; link paydo bo'lsa flag ham yangilanadi.

    Avval flagged bo'lgan xabar flagged bo'lib qoladi (moderatsiya dalili saqlanadi).
    """
    msg.text = text
    link = has_link(text)
    phone = has_phone(text)
    msg.has_link = link
    msg.has_phone = phone
    msg.flagged = bool(msg.flagged or link or phone or msg.attachment_url)
    msg.edited_at = _now()
    await db.flush()
    return msg


async def recompute_thread_state(db: AsyncSession, thread: ChatThread) -> None:
    """Thread navbat holatini KO'RINADIGAN (o'chirilmagan) xabarlar bo'yicha qayta hisoblaydi.

    Xabar o'chirilgach chaqiriladi: o'chirilgan javobsiz user xabari thread'ni navbatda
    abadiy 'javob kutmoqda' holatida (bo'sh/ko'rinmas) qoldirmasin. Ustoz o'z javobini
    o'chirsa — user savoli yana javobsiz bo'lib navbatga qaytadi (to'g'ri xatti-harakat).
    """
    msgs = await list_messages(db, thread.id, limit=1000)  # ko'rinadigan, created_at asc
    if not msgs:
        thread.awaiting_reply = False
        thread.awaiting_since = None
        thread.last_msg_at = None
        await db.flush()
        return
    thread.last_msg_at = msgs[-1].created_at
    last_teacher_at = None
    for m in msgs:
        if m.sender == "teacher":
            last_teacher_at = m.created_at
    # Oxirgi ustoz javobidan keyingi (yoki umuman javobsiz) eng eski user xabari
    awaiting_since = None
    for m in msgs:
        if m.sender == "user" and (
            last_teacher_at is None or m.created_at > last_teacher_at
        ):
            awaiting_since = m.created_at
            break
    thread.awaiting_reply = awaiting_since is not None
    thread.awaiting_since = awaiting_since
    await db.flush()


async def soft_delete_message(db: AsyncSession, msg: ChatMessage) -> None:
    """Soft-delete: user/ustoz ko'rmaydi, admin belgisi bilan ko'radi.
    O'chirilgach thread navbat holati qayta hisoblanadi."""
    msg.deleted_at = _now()
    await db.flush()
    thread = await db.get(ChatThread, msg.thread_id)
    if thread is not None:
        await recompute_thread_state(db, thread)


async def dismiss_flag(db: AsyncSession, msg: ChatMessage) -> None:
    """Admin ogohlantirishni o'chiradi (ko'rib chiqildi): flag olib tashlanadi,
    xabar suhbatda qoladi. Warnings ro'yxatidan yo'qoladi."""
    msg.flagged = False
    await db.flush()


async def add_message(
    db: AsyncSession,
    thread: ChatThread,
    *,
    sender: str,
    text: Optional[str],
    attachment_url: Optional[str] = None,
    attachment_name: Optional[str] = None,
    attachment_type: Optional[str] = None,
) -> ChatMessage:
    """Xabar qo'shadi + navbat holatini yangilaydi + shubhali kontentni belgilaydi."""
    link = has_link(text)
    phone = has_phone(text)
    # link / telefon / fayl / rasm -> admin ogohlantirishi
    flagged = bool(link or phone or attachment_url)
    msg = ChatMessage(
        thread_id=thread.id,
        sender=sender,
        text=text,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        attachment_type=attachment_type,
        has_link=link,
        has_phone=phone,
        flagged=flagged,
    )
    db.add(msg)
    now = _now()
    thread.last_msg_at = now
    if sender == "user":
        if not thread.awaiting_reply:
            thread.awaiting_reply = True
            thread.awaiting_since = now
    else:  # teacher javob berdi -> navbatdan chiqadi (oxiriga tushadi)
        thread.awaiting_reply = False
        thread.awaiting_since = None
    await db.flush()
    return msg


# ---------------- Admin moderation ----------------
async def all_threads(db: AsyncSession) -> list[tuple[ChatThread, User, User]]:
    """Barcha suhbatlar (user, teacher-user bilan) — oxirgi xabar bo'yicha."""
    res = await db.execute(
        select(ChatThread, User, TeacherProfile)
        .join(User, User.id == ChatThread.user_id)
        .join(TeacherProfile, TeacherProfile.id == ChatThread.teacher_id)
        .order_by(ChatThread.last_msg_at.desc())
    )
    rows = []
    for thread, user, profile in res.all():
        teacher_user = await db.get(User, profile.user_id)
        rows.append((thread, user, teacher_user))
    return rows


async def flagged_messages(
    db: AsyncSession, *, limit: int = 100
) -> list[tuple[ChatMessage, ChatThread]]:
    res = await db.execute(
        select(ChatMessage, ChatThread)
        .join(ChatThread, ChatThread.id == ChatMessage.thread_id)
        .where(ChatMessage.flagged.is_(True))
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    return [(m, t) for m, t in res.all()]


async def last_message_text(db: AsyncSession, thread_id: str) -> Optional[str]:
    res = await db.execute(
        select(ChatMessage)
        .where(
            ChatMessage.thread_id == thread_id, ChatMessage.deleted_at.is_(None)
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )
    msg = res.scalar_one_or_none()
    if msg is None:
        return None
    if msg.text:
        return msg.text[:80]
    return "📎 " + (msg.attachment_name or "biriktirma")


async def flagged_count_for_thread(db: AsyncSession, thread_id: str) -> int:
    res = await db.execute(
        select(func.count())
        .select_from(ChatMessage)
        .where(ChatMessage.thread_id == thread_id, ChatMessage.flagged.is_(True))
    )
    return int(res.scalar_one())
