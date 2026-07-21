/** Ilova (o'rnatilgan PWA / standalone / Capacitor APK) rejimida ishlayaptimi yoki brauzerda? */
export function isApp(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor native ilova (Android/iOS APK): WebView'da "display-mode: standalone"
  // media so'rovi FALSE qaytaradi, shuning uchun alohida tekshiramiz. Capacitor
  // o'rnatilmagan bo'lsa window.Capacitor undefined -> quyidagi PWA mantiqiga o'tadi.
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari "Add to Home Screen"
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(standalone || iosStandalone);
}

/** Hozir internet bormi? */
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}
