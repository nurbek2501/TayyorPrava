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

/** Telegram ruxsat sahifasiga o'tkazadi (shu oynada — mobil brauzerlarda ham ishonchli). */
export function redirectToTelegram(botId: string, returnTo: string): void {
  const url =
    "https://oauth.telegram.org/auth?" +
    new URLSearchParams({
      bot_id: botId,
      origin: window.location.origin,
      return_to: returnTo,
      request_access: "write",
    }).toString();
  window.location.href = url;
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
