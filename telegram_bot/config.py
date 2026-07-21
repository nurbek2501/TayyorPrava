"""Bot sozlamalari — .env dan yoki standart qiymatlardan o'qiladi."""
import os

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except Exception:
    pass

# Telegram bot tokeni (@BotFather) — MAXFIY, faqat .env da bo'lsin
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# Obuna tekshiriladigan kanal (bot shu kanalga admin bo'lishi shart!)
CHANNEL = os.getenv("TELEGRAM_CHANNEL", "@TayyorPrava")
CHANNEL_URL = os.getenv("CHANNEL_URL", "https://t.me/TayyorPrava")

# Backend API manzili va bot bilan umumiy maxfiy kalit
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000/api")
# backend .env dagi BOT_SHARED_SECRET bilan AYNAN bir xil bo'lishi shart
BOT_SHARED_SECRET = os.getenv("BOT_SHARED_SECRET", "")
