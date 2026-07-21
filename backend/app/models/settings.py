"""Global site settings (single row)."""
from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    site_name: Mapped[str] = mapped_column(String(128), default="TayyorPrava")
    default_lang: Mapped[str] = mapped_column(String(8), default="uz")
    default_theme: Mapped[str] = mapped_column(String(16), default="dark")
    exam_question_count: Mapped[int] = mapped_column(Integer, default=20)
    exam_duration_min: Mapped[int] = mapped_column(Integer, default=25)
    exam_max_mistakes: Mapped[int] = mapped_column(Integer, default=3)
    real_exam_question_count: Mapped[int] = mapped_column(Integer, default=20)
    real_exam_duration_min: Mapped[int] = mapped_column(Integer, default=25)
    real_exam_max_mistakes: Mapped[int] = mapped_column(Integer, default=2)
    # "Guvohnomadan mahrum bo'lganlar" (qayta topshirish, 50 savol) uchun MUSTAQIL
    # ruxsat etilgan xato soni — real_exam_max_mistakes'dan proportsional HISOBLANMAYDI,
    # admin ikkalasini alohida sozlaydi (default 4).
    real_exam_restore_max_mistakes: Mapped[int] = mapped_column(
        Integer, default=4, server_default="4"
    )
    # Real imtihonga bir martalik kirish narxi (so'm) — admin belgilaydi
    real_exam_price: Mapped[int] = mapped_column(Integer, default=12000)
    # Admin real imtihon bo'limini vaqtincha butunlay yopishi mumkin — yoqilganda
    # HECH KIM (yangi sotib olish HAM, mavjud ishlatilmagan ticket bilan boshlash HAM)
    # kira olmaydi. Tekshirish/texnik xizmat vaqtida ishlatiladi.
    real_exam_locked: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )
    referral_bonus: Mapped[int] = mapped_column(Integer, default=10000)
    # --- Smart test (aqlli test) — admin sozlaydi ---
    # Savol "o'zlashtirilgan" sanalishi uchun ketma-ket nechta to'g'ri javob kerak.
    smart_test_streak: Mapped[int] = mapped_column(
        Integer, default=5, server_default="5"
    )
    # Bilmagan savollar foizi shu chegaradan PAST bo'lsa — real imtihon tavsiya etiladi.
    smart_test_advice_percent: Mapped[int] = mapped_column(
        Integer, default=50, server_default="50"
    )

    # --- Mehmon paneli (landing) — admin tomonidan boshqariladi ---
    landing_badge: Mapped[str] = mapped_column(
        String(160), default="🚗 O'zbekistondagi #1 avtotest platformasi"
    )
    landing_title: Mapped[str] = mapped_column(
        String(256),
        default="Haydovchilik guvohnomasini birinchi urinishda oling",
    )
    landing_subtitle: Mapped[str] = mapped_column(
        String(512),
        default=(
            "Real imtihon simulyatori, 3 tilli savollar, xatolar ustida ishlash "
            "va shaxsiy statistika — barchasi bitta zamonaviy platformada."
        ),
    )
    landing_cta: Mapped[str] = mapped_column(String(80), default="Bepul boshlash")
    landing_telegram: Mapped[str] = mapped_column(String(80), default="@tayyorprava")
    landing_phone: Mapped[str] = mapped_column(String(40), default="+998 90 000 00 00")
