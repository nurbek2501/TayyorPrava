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
  { key: "auth.ruleMin8", test: (v) => v.length >= 8 },
  { key: "auth.ruleUpper", test: (v) => /[A-Z]/.test(v) },
  { key: "auth.ruleDigit", test: (v) => /[0-9]/.test(v) },
  { key: "auth.ruleAlnum", test: (v) => v.length > 0 && /^[A-Za-z0-9]+$/.test(v) },
];

export const PASSWORD_RULES: Rule[] = [
  { key: "auth.ruleMin8", test: (v) => v.length >= 8 },
  { key: "auth.rulePwLetter", test: (v) => /[A-Za-z]/.test(v) },
  { key: "auth.rulePwDigit", test: (v) => /[0-9]/.test(v) },
];

export const isNicknameValid = (v: string) => NICKNAME_RULES.every((r) => r.test(v));
export const isPasswordValid = (v: string) => PASSWORD_RULES.every((r) => r.test(v));

/** Parol kuchi 0..3 (qoniqtirilgan qoidalar soni) — indikator uchun */
export const passwordStrength = (v: string) =>
  PASSWORD_RULES.filter((r) => r.test(v)).length;
