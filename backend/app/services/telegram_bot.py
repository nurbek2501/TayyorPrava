"""Telegram bot — webhook rejimi (backend ichida, alohida worker kerak emas).

`telegram_bot/bot.py` dagi polling botning aynan shu mantiqi, faqat update'lar
Telegram'dan webhook orqali keladi (POST {API_PREFIX}/bot/webhook). Render free
planda worker bo'lmagani uchun bot shu yerda yashaydi.

Pullik planga qaytilganda: backend'dan BOT_TOKEN olib tashlanadi (webhook
o'rnatilmaydi) va telegram_bot/ worker'i tiklanadi — bot.py ishga tushishda
delete_webhook qilib, yana polling'da ishlaydi.

Oqim (bot.py bilan bir xil):
  1. Sayt «Botni ochish» tugmasi nikni avtomatik yuboradi (deep-link ?start=<nik>).
  2. Bot kanalga obunani tekshiradi.
  3. Obuna bo'lsa — 5 xonali kod yaratiladi (issue_code bilan bevosita, HTTP'siz).
  4. Obuna bo'lmasa — kanalga obuna + tasdiqlash tugmalari ko'rsatiladi.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import re

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.core.logging import logger
from app.db.session import AsyncSessionLocal
from app.schemas.auth import BotIssueCodeRequest

# Bitta umumiy HTTP klient (connection pool) — har so'rovga yangi klient
# yaratmaymiz. 100+ bir vaqtdagi ro'yxatda ulanishlar tugab qolmaydi.
http_client = httpx.AsyncClient(
    timeout=httpx.Timeout(10.0),
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
)

SUBSCRIBED = {"member", "administrator", "creator"}
# Saytdagi qoida bilan bir xil (backend/app/core/validators.py):
# 2-32 belgi, lotin harf/raqam/_/- (bo'sh joy va emojisiz).
NICK_RE = re.compile(r"^[A-Za-z0-9_-]{2,32}$")

WELCOME = (
    "👋 <b>Assalomu alaykum!</b>\n\n"
    "Men — <b>TayyorPrava</b> 🚗 tasdiqlash botiman.\n\n"
    "🔹 Saytda tanlagan <b>nikingizni</b> menga yuboring\n"
    "🔹 Men sizga maxsus <b>tasdiqlash kodini</b> beraman ✨\n\n"
    "📲 Nikingizni yuboring:"
)


def webhook_secret() -> str:
    """Telegram secret_token faqat [A-Za-z0-9_-] qabul qiladi — shared secret'dan
    deterministik hex hosil qilamiz (qiymat qanday bo'lishidan qat'i nazar yaroqli)."""
    return hashlib.sha256(
        ("tg-webhook:" + settings.BOT_SHARED_SECRET).encode()
    ).hexdigest()


def _api_url(method: str) -> str:
    return f"https://api.telegram.org/bot{settings.BOT_TOKEN}/{method}"


async def tg(method: str, **params):
    """Telegram Bot API chaqiruvi. Xatoda None qaytaradi (bot yiqilmaydi)."""
    try:
        r = await http_client.post(_api_url(method), json=params)
        data = r.json()
        if not data.get("ok"):
            logger.warning("Telegram API %s xato: %s", method, data.get("description"))
            return None
        return data.get("result")
    except Exception as e:
        logger.warning("Telegram API %s ulanish xatosi: %s", method, e)
        return None


async def safe_send(chat_id: int, text: str, **kwargs):
    """Telegram flood-limit (429) ga bardoshli xabar yuborish.

    100+ odam bir vaqtda kod so'rasa, Telegram «retry after N» qaytaradi —
    shu yerda kutib qayta yuboramiz, foydalanuvchi kodsiz qolmaydi.
    """
    for _ in range(3):
        try:
            r = await http_client.post(
                _api_url("sendMessage"),
                json={"chat_id": chat_id, "text": text, **kwargs},
            )
            data = r.json()
            if data.get("ok"):
                return data.get("result")
            if r.status_code == 429:
                retry = (data.get("parameters") or {}).get("retry_after", 1)
                await asyncio.sleep(retry + 0.5)
                continue
            logger.warning("send_message xato (chat %s): %s", chat_id, data.get("description"))
            return None
        except Exception as e:
            logger.warning("send_message ulanish xatosi (chat %s): %s", chat_id, e)
            return None
    return None


def nick_format_ok(nick: str) -> bool:
    """Saytdagi qoidalar bilan bir xil: 2–32 belgi, lotin harf/raqam/_/-."""
    return bool(NICK_RE.match(nick))


async def is_subscribed(user_id: int) -> bool:
    member = await tg(
        "getChatMember", chat_id=settings.TELEGRAM_CHANNEL, user_id=user_id
    )
    # kanal topilmasa / bot admin bo'lmasa tg() None qaytaradi -> obuna yo'q deb hisoblanadi
    return bool(member) and member.get("status") in SUBSCRIBED


def subscribe_kb(nick: str) -> dict:
    return {
        "inline_keyboard": [
            [{"text": "📢 Kanalga obuna bo'lish", "url": settings.CHANNEL_URL}],
            [{"text": "✅ Obunani tasdiqlash", "callback_data": f"check:{nick}"}],
        ]
    }


# ---------------- Asosiy mantiq ----------------
async def process_nick(chat_id: int, user_id: int, nick: str):
    """Nik bo'yicha: format -> obuna -> kod (yoki tegishli ogohlantirish)."""
    if not nick_format_ok(nick):
        # Format noto'g'ri — "sizniki emas" emas, balki boshqa (format) ogohlantirishi
        await safe_send(
            chat_id,
            "🤔 <b>Bu nik formatga to'g'ri kelmaydi.</b>\n\n"
            "Nik <b>2–32 ta belgi</b>dan iborat bo'ladi: lotin harflar, raqamlar, "
            "<code>_</code> va <code>-</code> (bo'sh joysiz).\n\n"
            "Saytdagi nikingizni xuddi o'zidek yuboring — masalan: <code>driver_25</code>.",
            parse_mode="HTML",
        )
        return

    if not await is_subscribed(user_id):
        await safe_send(
            chat_id,
            "📢 <b>Bitta qadam qoldi!</b>\n\n"
            f"Kod olish uchun avval <b>{settings.TELEGRAM_CHANNEL}</b> kanalimizga obuna bo'ling, "
            "so'ng <b>«✅ Obunani tasdiqlash»</b> tugmasini bosing 👇",
            reply_markup=subscribe_kb(nick),
            parse_mode="HTML",
        )
        return

    await issue_and_send(chat_id, user_id, nick)


async def issue_and_send(chat_id: int, user_id: int, nick: str):
    # Kech import — routes/bot.py shu modulni import qiladi (aylanma importni oldini oladi).
    from app.api.routes.bot import issue_code

    try:
        async with AsyncSessionLocal() as db:
            resp = await issue_code(
                BotIssueCodeRequest(nickname=nick, telegram_id=str(user_id)), db
            )
    except HTTPException as e:
        detail = e.detail if isinstance(e.detail, str) else ""
        if e.status_code == 404:
            await safe_send(
                chat_id,
                f"❌ <b>{nick}</b> niki topilmadi.\n\n"
                "Avval saytda ro'yxatdan o'ting, so'ng «Botni ochish» tugmasini bosing.",
                parse_mode="HTML",
            )
        elif e.status_code == 409:
            # Bir Telegram = bir nik: bu telegram boshqa nikka bog'langan
            await safe_send(
                chat_id,
                "⛔️ <b>Bu nik sizga tegishli emas</b>\n\n"
                + (detail or "Bu Telegram akkaunt boshqa nikka bog'langan.")
                + "\n\nℹ️ Har bir Telegram akkaunt faqat <b>bitta</b> nikka bog'lanadi.\n"
                "Agar bu xato bo'lsa — administratorga murojaat qiling.",
                parse_mode="HTML",
            )
        elif e.status_code == 403:
            # Telegramga bog'lanmagan akkaunt (masalan ustoz) — bot orqali reset qilib bo'lmaydi
            await safe_send(
                chat_id,
                "🔒 <b>Bu akkaunt bot orqali tiklanmaydi</b>\n\n"
                + (detail or "Bu akkaunt Telegramga bog'lanmagan.")
                + "\n\nℹ️ Administrator bilan bog'laning.",
                parse_mode="HTML",
            )
        else:
            await safe_send(chat_id, "⚠️ Kod yaratishda xato. Birozdan keyin urinib ko'ring.")
        return
    except Exception as e:
        logger.error("kod yaratishda xato: %s", e)
        await safe_send(chat_id, "⚠️ Kod yaratishda xato. Birozdan keyin urinib ko'ring.")
        return

    action = "ro'yxatdan o'tish" if resp.purpose == "register" else "parolni tiklash"
    await safe_send(
        chat_id,
        "✅ <b>Obuna tasdiqlandi!</b>\n\n"
        f"🔐 <b>{nick}</b> uchun {action} kodi:\n\n"
        f"<code>{resp.code}</code>\n"
        "👆 <i>ustiga bosib nusxa oling</i>\n\n"
        "⏳ Kod <b>5 daqiqa</b> amal qiladi — uni saytdagi maydonga kiriting.",
        parse_mode="HTML",
    )


# ---------------- Webhook update dispatcher (bot.py handlerlari o'rnida) ----------------
async def process_update(update: dict) -> None:
    """Bitta Telegram update'ini qayta ishlaydi. Xatolar yutiladi (200 qaytishi uchun —
    aks holda Telegram bir xil update'ni qayta-qayta yuboraveradi)."""
    try:
        msg = update.get("message")
        cb = update.get("callback_query")

        if msg is not None:
            text = (msg.get("text") or "").strip()
            chat_id = (msg.get("chat") or {}).get("id")
            user_id = (msg.get("from") or {}).get("id")
            if not text or chat_id is None or user_id is None:
                return
            if text.startswith("/start"):
                payload = text[len("/start"):].strip()
                if payload:  # «Botni ochish» tugmasidan nik avtomatik keldi
                    await process_nick(chat_id, user_id, payload)
                else:
                    await safe_send(chat_id, WELCOME, parse_mode="HTML")
            elif text.startswith("/"):
                return
            else:
                await process_nick(chat_id, user_id, text)

        elif cb is not None:
            data = cb.get("data") or ""
            cb_id = cb.get("id")
            if not data.startswith("check:"):
                if cb_id:
                    await tg("answerCallbackQuery", callback_query_id=cb_id)
                return
            nick = data.split(":", 1)[1]
            user_id = (cb.get("from") or {}).get("id")
            message = cb.get("message") or {}
            chat_id = (message.get("chat") or {}).get("id")
            if user_id is None:
                return
            if not await is_subscribed(user_id):
                await tg(
                    "answerCallbackQuery",
                    callback_query_id=cb_id,
                    text="Hali obuna bo'lmadingiz ❌ Avval kanalga obuna bo'ling.",
                    show_alert=True,
                )
                return
            await tg("answerCallbackQuery", callback_query_id=cb_id, text="Obuna tasdiqlandi ✅")
            if chat_id is not None and message.get("message_id"):
                await tg(
                    "editMessageReplyMarkup",
                    chat_id=chat_id,
                    message_id=message["message_id"],
                )
            if chat_id is not None:
                await issue_and_send(chat_id, user_id, nick)
    except Exception:
        logger.exception("Webhook update qayta ishlashda xato")


# ---------------- Ishga tushirish / to'xtatish ----------------
def _webhook_base() -> str:
    # Render web xizmatida RENDER_EXTERNAL_URL avtomatik beriladi (haqiqiy tashqi URL) —
    # xizmat nomi o'zgarsa ham webhook to'g'ri manzilga o'rnatiladi.
    return (settings.WEBHOOK_BASE_URL or os.getenv("RENDER_EXTERNAL_URL", "")).rstrip("/")


async def setup_webhook() -> None:
    """Ishga tushishda webhook'ni Telegram'da ro'yxatdan o'tkazadi.

    BOT_TOKEN / BOT_SHARED_SECRET / tashqi URL bo'lmasa (lokal dev yoki bot alohida
    worker'da) — jimgina o'tkazib yuboriladi, backend odatdagidek ishlayveradi.
    """
    if not settings.BOT_TOKEN:
        logger.info("BOT_TOKEN berilmagan — Telegram webhook o'rnatilmadi")
        return
    if not settings.BOT_SHARED_SECRET:
        logger.warning("BOT_SHARED_SECRET bo'sh — Telegram webhook o'rnatilmadi")
        return
    base = _webhook_base()
    if not base:
        logger.info("Tashqi URL yo'q (RENDER_EXTERNAL_URL/WEBHOOK_BASE_URL) — webhook o'rnatilmadi")
        return
    url = f"{base}{settings.API_PREFIX}/bot/webhook"
    # drop_pending_updates=False — uxlab turganda (free plan) kelgan xabarlar yo'qolmasin:
    # Telegram ularni navbatda saqlab, xizmat uyg'ongach qayta yetkazadi.
    result = await tg(
        "setWebhook",
        url=url,
        secret_token=webhook_secret(),
        drop_pending_updates=False,
        allowed_updates=["message", "callback_query"],
    )
    if result is not None:
        logger.info("Telegram webhook o'rnatildi: %s", url)
    else:
        logger.warning("Telegram webhook o'rnatilmadi (setWebhook xato) — 10 daqiqada qayta uriniladi")


async def webhook_keeper() -> None:
    """Webhook'ni davriy qayta tasdiqlab turadi (o'z-o'zini davolash).

    Nega kerak: xizmat qayta nomlansa (URL o'zgaradi), birinchi urinishda tarmoq xatosi
    bo'lsa, yoki eski polling bot qayerdadir ishga tushib webhook'ni o'chirib yuborsa —
    keyingi tsiklda o'zi tiklanadi. setWebhook idempotent (bir xil qiymatga qayta
    chaqirish zararsiz), 10 daqiqalik interval Telegram limitlariga ham yumshoq.
    """
    while True:
        await asyncio.sleep(600)
        try:
            await setup_webhook()
        except Exception:
            logger.exception("webhook_keeper aylanishida xato")


async def shutdown() -> None:
    await http_client.aclose()
