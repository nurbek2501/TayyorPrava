/**
 * Nickname va parol tekshirish qoidalari (jonli, forma uchun).
 * Backenddagi `core/validators.py` qoidalari bilan AYNAN bir xil bo'lishi shart.
 */

export interface Rule {
  /** i18n kalit (RequirementList `t(key)` orqali tarjima qiladi) */
  key: string;
  test: (v: string) => boolean;
}

export const NICKNAME_RULES: Rule[] = [
  { key: "auth.ruleNickLen", test: (v) => v.length >= 2 && v.length <= 32 },
  // Bo'sh joy/emoji taqiqlangan: nik bot chatiga ham yoziladi.
  { key: "auth.ruleNickChars", test: (v) => v.length > 0 && /^[A-Za-z0-9_-]+$/.test(v) },
];

export const PASSWORD_RULES: Rule[] = [
  { key: "auth.ruleMin4", test: (v) => v.length >= 4 },
];

export const isNicknameValid = (v: string) => NICKNAME_RULES.every((r) => r.test(v));
export const isPasswordValid = (v: string) => PASSWORD_RULES.every((r) => r.test(v));

/** Parol kuchi 0..N (qoniqtirilgan qoidalar soni) — indikator uchun */
export const passwordStrength = (v: string) =>
  PASSWORD_RULES.filter((r) => r.test(v)).length;
