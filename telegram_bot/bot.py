"""TayyorPrava — ro'yxat/parol tasdiqlash boti (aiogram 3).

Oqim:
  1. Sayt «Botni ochish» tugmasi nikni avtomatik yuboradi (deep-link ?start=<nik>).
  2. Bot @TayyorPrava kanaliga obunani tekshiradi.
  3. Obuna bo'lsa — backenddan 5 xonali kod oladi va NUSXA OLISHGA TAYYOR holatda yuboradi.
  4. Obuna bo'lmasa — kanalga obuna + tasdiqlash tugmalarini ko'rsatadi.
"""
import asyncio
import logging
import re

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.enums import ChatMemberStatus
from aiogram.exceptions import TelegramAPIError, TelegramRetryAfter
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tayyorprava-bot")

bot = Bot(config.BOT_TOKEN)
dp = Dispatcher()

# Bitta umumiy HTTP klient (connection pool) — har so'rovga yangi klient
# yaratmaymiz. 100+ bir vaqtdagi ro'yxatda ulanishlar tugab qolmaydi.
http_client = httpx.AsyncClient(
    timeout=httpx.Timeout(10.0),
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
)


async def safe_send(chat_id: int, text: str, **kwargs):
    """Telegram flood-limit (429) ga bardoshli xabar yuborish.

    100+ odam bir vaqtda kod so'rasa, Telegram «retry after N» qaytaradi —
    shu yerda kutib qayta yuboramiz, foydalanuvchi kodsiz qolmaydi.
    """
    for _ in range(3):
        try:
            return await bot.send_message(chat_id, text, **kwargs)
        except TelegramRetryAfter as e:
            await asyncio.sleep(e.retry_after + 0.5)
        except TelegramAPIError as e:
            logger.warning("send_message xato (chat %s): %s", chat_id, e)
            return None
    return None

SUBSCRIBED = {
    ChatMemberStatus.MEMBER,
    ChatMemberStatus.ADMINISTRATOR,
    ChatMemberStatus.CREATOR,
}
NICK_RE = re.compile(r"^[A-Za-z0-9]{8,32}$")


def nick_format_ok(nick: str) -> bool:
    """Saytdagi qoidalar bilan bir xil: 8–32 lotin alnum, ≥1 katta harf, ≥1 raqam."""
    return bool(
        NICK_RE.match(nick)
        and any(c.isupper() for c in nick)
        and any(c.isdigit() for c in nick)
    )


# ---------------- Yordamchilar ----------------
async def is_subscribed(user_id: int) -> bool:
    try:
        member = await bot.get_chat_member(config.CHANNEL, user_id)
        return member.status in SUBSCRIBED
    except Exception as e:  # kanal topilmasa / bot admin bo'lmasa
        logger.warning("get_chat_member xato: %s", e)
        return False


def subscribe_kb(nick: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📢 Kanalga obuna bo'lish", url=config.CHANNEL_URL)],
            [InlineKeyboardButton(text="✅ Obunani tasdiqlash", callback_data=f"check:{nick}")],
        ]
    )


WELCOME = (
    "👋 <b>Assalomu alaykum!</b>\n\n"
    "Men — <b>TayyorPrava</b> 🚗 tasdiqlash botiman.\n\n"
    "🔹 Saytda tanlagan <b>nikingizni</b> menga yuboring\n"
    "🔹 Men sizga maxsus <b>tasdiqlash kodini</b> beraman ✨\n\n"
    "📲 Nikingizni yuboring:"
)


# ---------------- Asosiy mantiq ----------------
async def process_nick(chat_id: int, user_id: int, nick: str):
    """Nik bo'yicha: format -> obuna -> kod (yoki tegishli ogohlantirish)."""
    if not nick_format_ok(nick):
        # Format noto'g'ri — "sizniki emas" emas, balki boshqa (format) ogohlantirishi
        await safe_send(
            chat_id,
            "🤔 <b>Bu nik formatga to'g'ri kelmaydi.</b>\n\n"
            "Nik kamida <b>8 ta belgi</b>, <b>1 ta KATTA harf</b> va "
            "<b>1 ta raqam</b>dan iborat bo'ladi (faqat lotin harf va raqam).\n\n"
            "Saytdagi nikingizni xuddi o'zidek yuboring — masalan: <code>Driver2025</code>.",
            parse_mode="HTML",
        )
        return

    if not await is_subscribed(user_id):
        await safe_send(
            chat_id,
            "📢 <b>Bitta qadam qoldi!</b>\n\n"
            f"Kod olish uchun avval <b>{config.CHANNEL}</b> kanalimizga obuna bo'ling, "
            "so'ng <b>«✅ Obunani tasdiqlash»</b> tugmasini bosing 👇",
            reply_markup=subscribe_kb(nick),
            parse_mode="HTML",
        )
        return

    await issue_and_send(chat_id, user_id, nick)


async def issue_and_send(chat_id: int, user_id: int, nick: str):
    try:
        r = await http_client.post(
            f"{config.BACKEND_URL}/bot/issue-code",
            json={"nickname": nick, "telegramId": str(user_id)},
            headers={"X-Bot-Secret": config.BOT_SHARED_SECRET},
        )
    except Exception as e:
        logger.error("backend bilan bog'lanish xato: %s", e)
        await safe_send(chat_id, "⚠️ Server bilan bog'lanishda xato. Birozdan keyin urinib ko'ring.")
        return

    if r.status_code == 404:
        await safe_send(
            chat_id,
            f"❌ <b>{nick}</b> niki topilmadi.\n\n"
            "Avval saytda ro'yxatdan o'ting, so'ng «Botni ochish» tugmasini bosing.",
            parse_mode="HTML",
        )
        return
    if r.status_code == 409:
        # Bir Telegram = bir nik: bu telegram boshqa nikka bog'langan
        try:
            detail = (r.json() or {}).get("detail", "")
        except Exception:
            detail = ""
        await safe_send(
            chat_id,
            "⛔️ <b>Bu nik sizga tegishli emas</b>\n\n"
            + (detail or "Bu Telegram akkaunt boshqa nikka bog'langan.")
            + "\n\nℹ️ Har bir Telegram akkaunt faqat <b>bitta</b> nikka bog'lanadi.\n"
            "Agar bu xato bo'lsa — administratorga murojaat qiling.",
            parse_mode="HTML",
        )
        return
    if r.status_code == 403:
        # Telegramga bog'lanmagan akkaunt (masalan ustoz) — bot orqali reset qilib bo'lmaydi
        try:
            detail = (r.json() or {}).get("detail", "")
        except Exception:
            detail = ""
        await safe_send(
            chat_id,
            "🔒 <b>Bu akkaunt bot orqali tiklanmaydi</b>\n\n"
            + (detail or "Bu akkaunt Telegramga bog'lanmagan.")
            + "\n\nℹ️ Administrator bilan bog'laning.",
            parse_mode="HTML",
        )
        return
    if r.status_code != 200:
        await safe_send(chat_id, "⚠️ Kod yaratishda xato. Birozdan keyin urinib ko'ring.")
        return

    data = r.json()
    code = data["code"]
    action = "ro'yxatdan o'tish" if data.get("purpose") == "register" else "parolni tiklash"
    await safe_send(
        chat_id,
        "✅ <b>Obuna tasdiqlandi!</b>\n\n"
        f"🔐 <b>{nick}</b> uchun {action} kodi:\n\n"
        f"<code>{code}</code>\n"
        "👆 <i>ustiga bosib nusxa oling</i>\n\n"
        "⏳ Kod <b>5 daqiqa</b> amal qiladi — uni saytdagi maydonga kiriting.",
        parse_mode="HTML",
    )


# ---------------- Handlerlar ----------------
@dp.message(CommandStart())
async def cmd_start(m: Message, command: CommandObject):
    payload = (command.args or "").strip()
    if payload:  # «Botni ochish» tugmasidan nik avtomatik keldi
        await process_nick(m.chat.id, m.from_user.id, payload)
    else:
        await m.answer(WELCOME, parse_mode="HTML")


@dp.message(F.text)
async def on_text(m: Message):
    nick = (m.text or "").strip()
    if nick.startswith("/"):
        return
    await process_nick(m.chat.id, m.from_user.id, nick)


@dp.callback_query(F.data.startswith("check:"))
async def cb_check(c: CallbackQuery):
    nick = c.data.split(":", 1)[1]
    if not await is_subscribed(c.from_user.id):
        await c.answer("Hali obuna bo'lmadingiz ❌ Avval kanalga obuna bo'ling.", show_alert=True)
        return
    await c.answer("Obuna tasdiqlandi ✅")
    try:
        await c.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
    await issue_and_send(c.message.chat.id, c.from_user.id, nick)


async def main():
    logger.info("Bot ishga tushdi. Kanal: %s", config.CHANNEL)
    await bot.delete_webhook(drop_pending_updates=True)
    try:
        await dp.start_polling(bot)
    finally:
        await http_client.aclose()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
