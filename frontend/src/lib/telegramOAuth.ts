/** Telegram OAuth (redirect oqimi).
 *
 * Widget iframe o'rniga: saytdagi bitta tugma foydalanuvchini to'g'ridan-to'g'ri
 * Telegram'ning ruxsat berish sahifasiga olib boradi. Telegram tasdiqlangach
 * `return_to` manzilga `#tgAuthResult=<base64 JSON>` bilan qaytaradi.
 */

export interface TelegramAuthUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Telegram ilovasini ochadi — tasdiqlash so'rovi «Telegram» (service notifications)
 * chatiga keladi. Ilova o'rnatilmagan bo'lsa hech narsa ochilmaydi. */
export const TELEGRAM_APP_URL = "tg://openmessage?user_id=777000";

/** Mobil qurilmami? Mobilda yangi tab noqulay — to'g'ridan-to'g'ri redirect qilamiz. */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
}

function authUrl(botId: string, returnTo: string): string {
  return (
    "https://oauth.telegram.org/auth?" +
    new URLSearchParams({
      bot_id: botId,
      origin: window.location.origin,
      return_to: returnTo,
      request_access: "write",
    }).toString()
  );
}

/** Telegram ruxsat sahifasini ochadi.
 *
 * Mobilda — shu oynada (yangi tab mobil brauzerlarda bloklanishi/adashtirishi mumkin).
 * Kompyuterda — YANGI TABDA, shunda login sahifasi ochiq qoladi va unda
 * «Telegram'ni ochish» tugmasi ko'rinadi (tasdiqlash so'roviga tez o'tish uchun).
 *
 * Qaytaradi: `true` — yangi tab ochildi (sahifa ochiq qoldi), `false` — redirect qilindi.
 */
export function openTelegramAuth(botId: string, returnTo: string): boolean {
  const url = authUrl(botId, returnTo);
  if (!isMobile()) {
    const tab = window.open(url, "_blank");
    if (tab) return true; // ochildi — sahifamiz ochiq qoladi
    // Brauzer yangi tabni bloklagan bo'lsa — redirect'ga tushamiz (kirish baribir ishlasin).
  }
  window.location.href = url;
  return false;
}

/** URL'dagi `#tgAuthResult=...` ni o'qiydi. Yo'q/buzilgan bo'lsa — null. */
export function readAuthResultFromHash(): TelegramAuthUser | null {
  const match = /[#&]tgAuthResult=([^&]+)/.exec(window.location.hash);
  if (!match) return null;
  try {
    // base64url -> base64 (+ padding)
    const b64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    // Ism kirill/lotin bo'lishi mumkin — UTF-8 sifatida dekodlaymiz (atob bayt beradi).
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data?.id || !data?.hash) return null;
    return data as TelegramAuthUser;
  } catch {
    return null;
  }
}

/** Manzil satridan `#tgAuthResult` ni tozalaydi (tarixga yozmasdan). */
export function clearAuthHash(): void {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

/** Xabar turi — yangi tab natijani ochgan sahifaga shu bilan uzatadi. */
export const TG_AUTH_MESSAGE = "tayyorprava:tg-auth";

/** Biz Telegram uchun ochilgan yangi tabdamizmi? */
export function isAuthTab(): boolean {
  try {
    return Boolean(window.opener) && window.opener !== window;
  } catch {
    return false;
  }
}

/** Natijani ochgan sahifaga uzatib, bu tabni yopadi.
 *  Qaytaradi: uzatildimi (yopilmasa ham kirish shu tabda davom etadi). */
export function sendResultToOpener(user: TelegramAuthUser): boolean {
  try {
    // Maqsad origin aniq ko'rsatiladi — natija boshqa saytga tushmasin.
    window.opener.postMessage({ type: TG_AUTH_MESSAGE, user }, window.location.origin);
    window.close();
    return true;
  } catch {
    return false;
  }
}
