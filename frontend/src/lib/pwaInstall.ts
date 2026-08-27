/**
 * PWA o'rnatish taklifini ERTA ushlash.
 *
 * NEGA ALOHIDA MODUL: brauzer `beforeinstallprompt` hodisasini sahifa yuklangan
 * zahoti yuboradi — React komponenti mount bo'lgunicha u allaqachon o'tib ketgan
 * bo'ladi. Komponent ichida `addEventListener` qilinsa, hodisa ushlanmay qoladi va
 * «Ilovani o'rnatish» tugmasi o'rniga «brauzer menyusidan qo'shing» yozuvi chiqadi.
 *
 * Shuning uchun tinglovchi shu modul IMPORT qilinishi bilan (React'gacha, main.tsx
 * boshida) ro'yxatdan o'tadi va hodisa saqlab qo'yiladi.
 */
import { useSyncExternalStore } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Brauzerning o'z bannerini to'xtatamiz — taklifni o'zimiz ko'rsatamiz.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Brauzer o'rnatishni qo'llab-quvvatlaydimi (taklif ushlanganmi)? */
export const canInstall = () => deferred !== null;

/** Shu sessiyada ilova o'rnatildimi? */
export const isInstalled = () => installed;

/** Komponentlar uchun: taklif tayyor bo'lganda qayta render bo'ladi. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, canInstall, () => false);
}

export function useIsInstalled(): boolean {
  return useSyncExternalStore(subscribe, isInstalled, () => false);
}

/** O'rnatish oynasini ochadi. Taklif yo'q bo'lsa "unavailable" qaytaradi. */
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  const ev = deferred;
  if (!ev) return "unavailable";
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    // Taklif bir martalik — ishlatilgach yaroqsiz bo'ladi.
    deferred = null;
    emit();
    return outcome;
  } catch {
    deferred = null;
    emit();
    return "unavailable";
  }
}
