import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor — PWA ni haqiqiy Android APK (va xohlasa iOS) ga o'rash.
 * Build qilish uchun Android Studio + JDK 17 kerak (qarang: ANDROID.md).
 */
const config: CapacitorConfig = {
  appId: "uz.tayyorprava.app",
  appName: "TayyorPrava",
  webDir: "dist",
  android: {
    backgroundColor: "#0B1120",
  },
  // --- Avtomatik yangilanish varianti ---
  // Quyidagini yoqsangiz, ilova jonli saytdan yuklaydi (hamma narsa avtomatik
  // yangilanadi), service worker esa offline'ni ta'minlaydi. Domeningizni yozing:
  // server: { url: "https://SIZNING-DOMEN.uz", androidScheme: "https" },
};

export default config;
