# -*- coding: utf-8 -*-
"""yol-belgilari.json -> 3 tilli (uz lotin / kaa kirill / ru) + servable rasm yo'llari.

uz: manba lotin. kaa: lotindan transliteratsiya (to_cyrillic). ru: rasmiy belgi nomlari.
Rasmlar /static/belgilar/<fayl> ga ishora qiladi (uploads/belgilar ga ko'chiriladi).
"""
import os, sys, json, shutil, re

BE = r"C:\Users\Nurbek\OneDrive\Desktop\Prava pro\backend"
sys.path.insert(0, BE)
os.chdir(BE)
from import_questions import to_cyrillic

SEED = os.path.join(BE, "seed_belgilar")
SRC = os.path.join(SEED, "yol-belgilari.json")
UPLOAD_IMG = os.path.join(BE, "uploads", "belgilar")


def norm(s: str) -> str:
    for a in "ʻ’‘`´ʼ":
        s = s.replace(a, "'")
    return re.sub(r"\s+", " ", s).strip()


# Kategoriya nomlari (raqamsiz) -> rus
CAT_RU = {
    "Ogohlantiruvchi belgilar": "Предупреждающие знаки",
    "Imtiyozli belgilar": "Знаки приоритета",
    "Ta'qiqlovchi belgilar": "Запрещающие знаки",
    "Buyuruvchi belgilar": "Предписывающие знаки",
    "Axborot-ishora belgilari": "Информационно-указательные знаки",
    "Servis belgilari": "Знаки сервиса",
    "Qo'shimcha axborot belgilari": "Знаки дополнительной информации",
}

# Belgi nomi (apostroflar normallangan) -> rasmiy rus nomi
RU = {
    "Shlagbaumli temir yo'l kesishmasi": "Железнодорожный переезд со шлагбаумом",
    "Shlagbaumsiz temir yo'l kesishmasi": "Железнодорожный переезд без шлагбаума",
    'Diqqat "UZP"': "Внимание «УЗП»",
    "Bir izli temir yo'l": "Однопутная железная дорога",
    "Ko'p izli temir yo'l": "Многопутная железная дорога",
    "Temir yo'l kesishmasining yaqinligi haqida ogohlantirish": "Приближение к железнодорожному переезду",
    "Tramvay yo'li bilan kesishuv": "Пересечение с трамвайной линией",
    "Teng ahamiyatli yo'llar kesishuvi": "Пересечение равнозначных дорог",
    "Aylanma harakatlanish bilan kesishuv": "Пересечение с круговым движением",
    "Svetofor tartibga soladi": "Светофорное регулирование",
    "Ko'tarma ko'prik": "Разводной мост",
    "Sohilga chiqish": "Выезд на набережную",
    "Xavfli burilish": "Опасный поворот",
    "Xavfli burilishlar": "Опасные повороты",
    "Tik nishablik": "Крутой спуск",
    "Tik balandlik": "Крутой подъём",
    "Sirpanchiq yo'l": "Скользкая дорога",
    "Notekis yo'l": "Неровная дорога",
    "Tosh otilish xavfi": "Выброс гравия",
    "Yo'lning torayishi": "Сужение дороги",
    "torayishi": "Сужение дороги",
    "Ikki tomonlama harakatlanish": "Двустороннее движение",
    "Piyodalar o'tish joyi": "Пешеходный переход",
    "Bolalar": "Дети",
    "Velosiped yo'lkasi bilan kesishuv": "Пересечение с велосипедной дорожкой",
    "Ta'mirlash ishlari": "Дорожные работы",
    "Mol haydab o'tish": "Перегон скота",
    "Yovvoyi hayvonlar": "Дикие животные",
    "Toshlar tushishi": "Падение камней",
    "Yonlama shamol": "Боковой ветер",
    "Pastlab uchuvchi samolyotlar": "Низко летящие самолёты",
    "Tonnel": "Тоннель",
    "Boshqa xavf-xatar": "Прочие опасности",
    "Sun'iy yo'l notekisliklari": "Искусственная неровность",
    "Burilishning yo'nalishi": "Направление поворота",
    "Tirbandlik": "Затор",
    "Asosiy yo'l": "Главная дорога",
    "Asosiy yo'lning oxiri": "Конец главной дороги",
    "Ikkinchi darajali yo'l bilan kesishuv": "Пересечение со второстепенной дорогой",
    "– tutashuv o'ngdan": "Примыкание второстепенной дороги справа",
    "– tutashuv chapdan": "Примыкание второстепенной дороги слева",
    "Yo'l bering": "Уступите дорогу",
    "To'xtamasdan harakatlanish taqiqlangan": "Движение без остановки запрещено",
    "Ro'para harakatlanishning ustunligi": "Преимущество встречного движения",
    "Ro'paradagi harakatlanishga nisbatan imtiyoz": "Преимущество перед встречным движением",
    "Kirish ta'qiqlangan": "Въезд запрещён",
    "Harakatlanish ta'qiqlangan": "Движение запрещено",
    "Mexanik transport vositalarining harakatlanishi taqiqlangan": "Движение механических транспортных средств запрещено",
    "Yuk avtomobillarining harakatlanishi taqiqlangan": "Движение грузовых автомобилей запрещено",
    "Mototsikllar harakatlanishi taqiqlangan": "Движение мотоциклов запрещено",
    "Traktorlar harakatlanishi taqiqlangan": "Движение тракторов запрещено",
    "Tirkama bilan harakatlanish taqiqlangan": "Движение с прицепом запрещено",
    "Ot-arava harakatlanishi taqiqlangan": "Движение гужевых повозок запрещено",
    "Velosipedda harakatlanish ta'qiqlangan": "Движение на велосипедах запрещено",
    "Piyodalarning harakatlanishi ta'qiqlangan": "Движение пешеходов запрещено",
    "Vazn cheklangan": "Ограничение массы",
    "O'qqa tushadigan og'irlik cheklangan": "Ограничение нагрузки на ось",
    "Cheklangan balandlik": "Ограничение высоты",
    "Cheklangan kenglik": "Ограничение ширины",
    "Cheklangan uzunlik": "Ограничение длины",
    "Eng kam oraliq": "Ограничение минимальной дистанции",
    "Bojxona": "Таможня",
    "Xavf-xatar": "Опасность",
    "O'ngga burilish ta'qiqlanadi": "Поворот направо запрещён",
    "Chapga burilish taqiqlanadi": "Поворот налево запрещён",
    "Qayrilish ta'qiqlanadi": "Разворот запрещён",
    "Quvib o'tish taqiqlanadi": "Обгон запрещён",
    "Quvib o'tish ta'qiqlangan hududning oxiri": "Конец зоны запрещения обгона",
    "Yuk avtomobillarida quvib o'tish taqiqlangan": "Обгон грузовым автомобилям запрещён",
    "Yuk avtommobillarida quvib o'tish taqiqlangan hududning oxiri": "Конец зоны запрещения обгона грузовым автомобилям",
    "Yuqori tezlik cheklangan": "Ограничение максимальной скорости",
    "Yuqori tezlik cheklangan hududning oxiri": "Конец зоны ограничения максимальной скорости",
    "Tovuch moslamalaridan foydalanish ta'qiqlangan": "Подача звукового сигнала запрещена",
    "To'xtash taqiqlangan": "Остановка запрещена",
    "To'xtab turish ta'qiqlangan": "Стоянка запрещена",
    "Oyning toq kunlarida to'xtab turish taqiqlanadi": "Стоянка запрещена по нечётным числам месяца",
    "Oyning juft kunlarida to'xtab turish taqiqlanadi": "Стоянка запрещена по чётным числам месяца",
    "Barcha cheklovlarning oxiri": "Конец всех ограничений",
    "Xavfli yuklarga ega transport vositalarining harakati ta'qiqlanadi": "Движение транспортных средств с опасными грузами запрещено",
    "Portlovchi va yonuvchan yuklarga ega transport vositalarining harakatlanishi ta'qiqlanadi": "Движение транспортных средств с взрывчатыми и легковоспламеняющимися грузами запрещено",
    "Harakatlanish to'g'riga": "Движение прямо",
    "Harakatlanish o'ngga": "Движение направо",
    "Harakatlanish chapga": "Движение налево",
    "Harakatlanish to'g'riga yoki o'ngga": "Движение прямо или направо",
    "Harakatlanish to'g'riga yoki chapga": "Движение прямо или налево",
    "Harakatlanish o'ngga yoki chapga": "Движение направо или налево",
    "To'siqni o'ngdan chetlab o'tish": "Объезд препятствия справа",
    "To'siqni chapdan chetlab o'tish": "Объезд препятствия слева",
    "To'siqni o'ngdan yoki chapdan chetlab o'tish": "Объезд препятствия справа или слева",
    "Aylanma harakatlanish": "Круговое движение",
    "Yengil avtomobillar harakatlanadi": "Движение легковых автомобилей",
    "Velosiped yo'lkasi": "Велосипедная дорожка",
    "Piyodalar yo'lkasi": "Пешеходная дорожка",
    "Piyoda va velosipedlar birgalikda harakatlanish yo'li": "Пешеходная и велосипедная дорожка с совмещённым движением",
    "Piyoda va velosipedlar birgalikda harakatlanish yo'li oxiri": "Конец пешеходной и велосипедной дорожки с совмещённым движением",
    "Ajratilgan piyoda va velosiped harakatlanish yo'li": "Пешеходная и велосипедная дорожка с разделённым движением",
    "Ajratilgan piyoda va velosiped harakatlanish yo'li oxiri": "Конец пешеходной и велосипедной дорожки с разделённым движением",
    "Eng kam tezlik": "Ограничение минимальной скорости",
    "Eng kam tezlik belgilangan yo'lning oxiri": "Конец зоны ограничения минимальной скорости",
    "Transport vositalarining xavfli yuklar bilan harakatlanish yo'nalishi": "Направление движения транспортных средств с опасными грузами",
    "Otda yurish yo'li": "Дорога для верховой езды",
    "Avtomagistral": "Автомагистраль",
    "Avtomagistralning oxiri": "Конец автомагистрали",
    "Avtomobillar uchun mo'ljallangan yo'l": "Дорога для автомобилей",
    "Avtomobillar uchun mo'ljallangan yo'lning oxiri": "Конец дороги для автомобилей",
    "Bir tomonlama harakatlanish yo'li": "Дорога с односторонним движением",
    "Bir tomonlama harakatlanish yo'lining oxiri": "Конец дороги с односторонним движением",
    "Bir tomonlama harakatlanish yo'liga chiqish": "Выезд на дорогу с односторонним движением",
    "Bo'laklar bo'yicha harakatlanish yo'nalishi": "Направление движения по полосам",
    "Bo'lak bo'yicha harakatlanish yo'nalishi": "Направление движения по полосе",
    "Bo'lakning boshlanishi": "Начало полосы",
    "Bo'lak oxiri": "Конец полосы",
    "Bo'laklar soni": "Число полос",
    "Belgilangan yo'nalishli transport vositalari uchun mo'ljallangan bo'lak": "Полоса для маршрутных транспортных средств",
    "Belgilangan yo'nalishli transport vositalari uchun bo'lagi bor yo'l": "Дорога с полосой для маршрутных транспортных средств",
    "Belgilangan yo'nalishli transport vositalari uchun bo'lagi bor yo'lning oxiri": "Конец дороги с полосой для маршрутных транспортных средств",
    "Qayirilish joyi": "Место для разворота",
    "Qayirilish oralig'i": "Зона для разворота",
    "Avtobus va trolleybus to'xtash joyi": "Место остановки автобуса и (или) троллейбуса",
    "Tramvay to'xtash joyi": "Место остановки трамвая",
    "Taksi to'xtab turish joyi": "Место стоянки такси",
    "To'xtab turish joyi": "Место стоянки",
    "Piyodalarning yer ostidan o'tish joyi": "Подземный пешеходный переход",
    "Piyodalarning yer ustidan o'tish joyi": "Надземный пешеходный переход",
    "Tavsiya etilgan tezlik": "Рекомендуемая скорость",
    "Oxiri berk yo'l, ko'cha": "Тупик",
    "Yo'nalishlarning dastlabki ko'rsatkichi": "Предварительный указатель направлений",
    "Harakatlanish tasviri": "Схема движения",
    "Yo'nalish ko'rsatkichi": "Указатель направления",
    "Yo'nalishlar ko'rsatkichi": "Указатель направлений",
    "Aholi yashaydigan joyning boshlanishi": "Начало населённого пункта",
    "Aholi yashaydigan joyning oxiri": "Конец населённого пункта",
    "Manzil nomi": "Наименование объекта",
    "Masofalar ko'rsatkichi": "Указатель расстояний",
    "Kilometr belgisi": "Километровый знак",
    "Yo'l raqami": "Номер дороги",
    "Yuk avtomobillari uchun harakatlanish yo'nalishi": "Направление движения для грузовых автомобилей",
    "Aylanib o'tish tasviri": "Схема объезда",
    "Chetlab o'tish yo'nalishi": "Направление объезда",
    "To'xtash": "Стоп",
    "Boshqa qatnov qismiga qayta tizilishning boshlang'ich ko'rsatkichi": "Начальный указатель перестроения на другую проезжую часть",
    "Reversiv harakatlanish": "Реверсивное движение",
    "Reversiv harakatlanish oxiri": "Конец реверсивного движения",
    "Reversiv harakatlanish yo'liga chiqish": "Выезд на дорогу с реверсивным движением",
    "Turar-joy dahasi": "Жилая зона",
    "Turar-joy dahasining oxiri": "Конец жилой зоны",
    "Falokatli holatlar uchun kirish yo'li": "Аварийный выезд",
    "Surat va video": "Фото- и видеофиксация",
    "Radar": "Радар",
    "Qizil rangda o'ng tomonga burilish": "Поворот направо на красный сигнал",
    "Velosipedlar uchun harakatlanish bo'lagi": "Полоса для велосипедистов",
    "Velosipedlar uchun harakatlanish bo'lagining oxiri": "Конец полосы для велосипедистов",
    "Tibbiy yordam ko'rsatish joyi": "Пункт первой медицинской помощи",
    "Shifoxona": "Больница",
    "Yonilg'i shaxobchasi": "Автозаправочная станция",
    "Texnik xizmat ko'rsatish joyi": "Техническое обслуживание автомобилей",
    "Transport vositalarini yuvish joyi": "Мойка автомобилей",
    "Telefon": "Телефон",
    "Oshxona": "Пункт питания",
    "Ichimlik suvi": "Питьевая вода",
    "Mehmonxona": "Гостиница",
    "Kemping": "Кемпинг",
    "Dam olish joyi": "Место отдыха",
    "Yo'l patrul xizmati maskani": "Пост дорожно-патрульной службы",
    "Xalqaro avtomobillarni tashish nazorat punkti": "Контрольный пункт международных автомобильных перевозок",
    "Xojatxona": "Туалет",
    "Axlat quti": "Мусорный бак",
    "Basseyn yoki sohil bo'yi": "Бассейн или пляж",
    "Polisiya": "Полиция",
    "Manzilgacha bo'lgan masofa": "Расстояние до объекта",
    "Ta'sir oralig'i": "Зона действия",
    "Ta'sir yo'nalishlari": "Направления действия",
    "Transport vositasining turi": "Вид транспортного средства",
    "Shanba, yakshanba va bayram kunlari": "Субботние, воскресные и праздничные дни",
    "Ish kunlari": "Рабочие дни",
    "Hafta kunlari": "Дни недели",
    "Amal qilish vaqti": "Время действия",
    "Transport vositasini to'xtab turish joyiga qo'yish usuli": "Способ постановки транспортного средства на стоянку",
    "Yurgizgichni ishlatmasdan to'xtab turish joyi": "Стоянка с неработающим двигателем",
    "Pullik xizmat ko'rsatish joyi": "Платные услуги",
    "To'xtab turish muddati cheklangan": "Ограничение продолжительности стоянки",
    "Avtomobillarni ko'rikdan o'tkazish joyi": "Место осмотра автомобилей",
    "To'la vazni cheklangan": "Ограничение разрешённой максимальной массы",
    "Xavfli yo'l yoqasi": "Опасная обочина",
    "Asosiy yo'lning yo'nalishi": "Направление главной дороги",
    "Harakatlanish bo'lagi": "Полоса движения",
    "Ko'zi ojiz piyodalar": "Слепые пешеходы",
    "Nam qoplama": "Влажное покрытие",
    "Nogironlar": "Инвалиды",
    "Nogironlar mustasno": "Кроме инвалидов",
    "Chorrahadagi kamera": "Камера на перекрёстке",
    "Xavfli yuk": "Опасный груз",
    "Evakuator ishlamoqda": "Работает эвакуатор",
    "Marshrutli transport vositasi turi": "Вид маршрутного транспортного средства",
}

data = json.load(open(SRC, encoding="utf-8"))
os.makedirs(UPLOAD_IMG, exist_ok=True)

missing_ru = set()
copied = 0
out_cats = []
for c in data["categories"]:
    cat_lat = c["category"]
    # "1. Ogohlantiruvchi belgilar" -> raqamni ajratamiz
    m = re.match(r"^\s*(\d+)\.\s*(.+)$", cat_lat)
    cnum, cbody = (m.group(1), m.group(2)) if m else ("", cat_lat)
    cru = CAT_RU.get(norm(cbody), "")
    if not cru:
        missing_ru.add("CAT: " + cbody)
    signs = []
    for s in c["signs"]:
        code, name = s["code"], s["name"]
        # 1.18.3 split xatosini tuzatish
        if name == "torayishi" and code.startswith("1.18.3"):
            code, name = "1.18.3", "Yo'lning torayishi"
        leaf = os.path.basename(s["imagePath"])
        # rasmni servable joyga ko'chirish
        srcimg = os.path.join(SEED, "rasmlar", leaf)
        if os.path.isfile(srcimg):
            shutil.copy2(srcimg, os.path.join(UPLOAD_IMG, leaf)); copied += 1
        ru = RU.get(norm(name), "")
        if not ru:
            missing_ru.add(name)
        signs.append({
            "code": code,
            "name": {"uz": name, "kaa": to_cyrillic(name), "ru": ru},
            "imageUrl": f"/static/belgilar/{leaf}",
        })
    out_cats.append({
        "code": cnum,
        "category": {"uz": cbody, "kaa": to_cyrillic(cbody), "ru": cru},
        "count": len(signs),
        "signs": signs,
    })

out = {
    "title": {
        "uz": "O'zbekiston yo'l harakati qoidalari — barcha yo'l belgilari",
        "kaa": to_cyrillic("O'zbekiston yo'l harakati qoidalari — barcha yo'l belgilari"),
        "ru": "Правила дорожного движения Узбекистана — все дорожные знаки",
    },
    "languages": ["uz", "kaa", "ru"],
    "totalSigns": sum(len(c["signs"]) for c in out_cats),
    "imagesBase": "/static/belgilar/",
    "categories": out_cats,
}
json.dump(out, open(os.path.join(SEED, "yol-belgilari-3til.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

print(f"Rasm ko'chirildi (uploads/belgilar): {copied}")
print(f"Belgilar: {out['totalSigns']} | kategoriyalar: {len(out_cats)}")
print(f"Rus tarjimasi YO'Q: {len(missing_ru)}")
for x in sorted(missing_ru)[:20]:
    print("   !", x)
print("\nNamuna (1.1):")
s0 = out_cats[0]["signs"][0]
print("  uz :", s0["name"]["uz"])
print("  kaa:", s0["name"]["kaa"])
print("  ru :", s0["name"]["ru"])
