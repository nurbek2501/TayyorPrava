import type { ContentLang, LocalizedText } from "./types";

// Real imtihon kontent tillari: O'zbek lotin (uz) va O'zbek kirill (kaa).
// `kaa` slotida hozir kirill matni saqlanadi. Rus (ru) ro'yxatda yo'q.
// Qoraqalpoq tili keyinroq, haqiqiy tarjima ma'lumoti kelganda qo'shiladi.
export const CONTENT_LANGS: { code: ContentLang; label: string; short: string }[] = [
  { code: "uz", label: "O'zbek (lotin)", short: "UZ" },
  { code: "kaa", label: "O'zbek (kirill)", short: "КИР" },
];

export function pickText(
  t: LocalizedText | undefined | null,
  lang: ContentLang
): string {
  if (!t) return "";
  return t[lang] || t.uz || t.ru || t.kaa || "";
}
