# TayyorPrava — Android ilovasi (PWA + APK)

Ilova **saytning aynan o'zi** — alohida kod yo'q, bitta loyiha. Eng yaxshi texnologiya:
**PWA (Progressive Web App)** + xohlasangiz **Capacitor** bilan haqiqiy `.apk`.

## ✨ Nimalar bor
- **Offline ishlaydi** — ilova qobig'i (44 fayl) va savol/rasm/sozlamalar telefonда saqlanadi (service worker). Internetsiz ham mashq qilinadi.
- **Onlaynда avtomatik yangilanadi** — internetga ulangach barcha ma'lumot (savollar, sozlamalar, narx…) va ilovaning o'zi avtomatik yangilanadi.
- **Admin bilan bog'langan** — ilova saytning backendidan foydalanadi, shuning uchun admin paneldagi har qanday o'zgarish ilovada ham aks etadi.
- **Sayt ikonkasi** bilan telefon ekraniga o'rnatiladi (standalone — to'liq ekran, brauzer paneliz).
- **Faqat bitta farq:** real imtihon bo'limiga kirilganda «Siz kompyuterda bajarsangiz, haqiqiy imtihon muhitini his qilasiz» animatsiyali maslahat chiqadi (faqat ilovada).
- Ilovada Android/iOS do'kon tugmalari **yo'q** (ular faqat saytda — «Ilovani o'rnatish»).

## 📲 Foydalanuvchi ilovani qanday o'rnatadi (PWA — hozir ishlaydi)
- **Android (Chrome):** saytni oching → Bosh sahifadagi **«Ilovani o'rnatish»** tugmasi (yoki brauzer menyusi → «Ilovani o'rnatish / Ekranga qo'shish»).
- **iOS (Safari):** Ulashish (Share) → **«Ekranga qo'shish» (Add to Home Screen)**.
- O'rnatilgach — ekranda TayyorPrava ikonkasi paydo bo'ladi, to'liq ekran ilova sifatida ochiladi.

## 🏗️ Haqiqiy `.apk` (do'konga / yuklab berishga) — Capacitor bilan
Build qilish uchun **Android Studio + JDK 17** o'rnatilgan kompyuter kerak (bu serverда yo'q).

```bash
cd frontend

# 1) Capacitor kutubxonalari (bir marta)
npm i @capacitor/core
npm i -D @capacitor/cli @capacitor/android

# 2) Android loyihasini yaratish (bir marta)
npx cap add android

# 3) Saytni build qilib, ilovaga ko'chirish (har yangilanishda)
npm run build
npx cap sync android

# 4) Android Studio'da ochish va APK/AAB yig'ish
npx cap open android
#   -> Android Studio: Build > Build Bundle(s)/APK(s) > Build APK(s)
#   yoki terminal:  cd android && ./gradlew assembleRelease
```

`capacitor.config.ts` allaqachon sozlangan (`appId: uz.tayyorprava.app`, `appName: TayyorPrava`, ikonkalar `public/` da).

### Yangilanish strategiyasi
- **Default:** `dist` ilova ichiga joylashtiriladi → darhol offline ishlaydi. Sayt qobig'i yangilansa, foydalanuvchiga yangi `.apk` kerak (ma'lumotlar esa baribir avtomatik yangilanadi).
- **To'liq avtomatik:** `capacitor.config.ts` da `server.url` ni domeningizga qo'ying → ilova jonli saytni yuklaydi (qobiq ham avtomatik yangilanadi), service worker offline'ni ta'minlaydi.

## 🔌 Ilovani saytga ulash
Bosh sahifadagi **«Ilovani o'rnatish»** tugmasi — PWA o'rnatish (do'kon tugmalari o'rniga). `.apk` chiqargach, uni ham shu bo'limga havola sifatida qo'shishingiz mumkin.
