// Shared types mirroring the backend camelCase API.

export type ContentLang = "kaa" | "uz" | "ru";
export type UiLang = "uz" | "kr" | "ru";
export type Theme = "light" | "dark" | "system";

export interface LocalizedText {
  kaa: string;
  uz: string;
  ru: string;
}

export interface Topic {
  id: number;
  nameUz: string;
  nameKaa: string;
  nameRu: string;
  orderIndex: number;
  questionCount: number;
}

export interface QuestionOption {
  id: string;
  optionId?: string;
  text: LocalizedText;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  topicId: number;
  text: LocalizedText;
  imageUrl?: string | null;
  options: QuestionOption[];
  explanation?: LocalizedText | null;
  createdAt: string;
}

export interface QuestionList {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Tariff {
  id: string;
  title: string;
  durationDays: number;
  price: number;
  type: string;
  isActive: boolean;
  orderIndex: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  logoUrl: string;
  isEnabled: boolean;
  orderIndex: number;
}

export interface UserProfile {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
  phone: string;
  email?: string | null;
  telegram?: string | null;
  telegramId?: string | null;
  avatarUrl?: string | null;
  role: string;
  isBlocked: boolean;
  blockReason?: string | null;
  blockedAt?: string | null;
  blockUntil?: string | null;
  blockCount?: number;
  refCode?: string | null;
  createdAt: string;
  subscriptionActive: boolean;
  subscriptionExpiresAt?: string | null;
}

export interface UserList {
  items: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Payment {
  id: string;
  userId?: string | null;
  userName?: string | null;
  userNickname?: string | null;
  tariffId?: string | null;
  tariffTitle?: string | null;
  method: string;
  phone: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface PaymentList {
  items: Payment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface MeStats {
  favorites: number;
  mistakes: number;
  allMistakesPercent: number;
}

export interface ReferralStats {
  bonus: number;
  invited: number;
  paid: number;
  refCode: string;
  refLink: string;
}

export interface DashboardSummary {
  totalQuestions: number;
  totalUsers: number;
  activeSubscriptions: number;
  todayPayments: number;
  totalRevenue: number;
  referralSignups: number;
  newUsersToday: number;
  examsToday: number;
  examsTotal: number;
  avgExamScore: number;
  passRate: number;
  realExamRevenue: number;
  realExamEntries: number;
  telegramBound: number;
}

export interface TimeseriesPoint {
  date: string;
  registrations: number;
  payments: number;
  revenue: number;
}

export interface Timeseries {
  range: string;
  points: TimeseriesPoint[];
}

export interface TopicDistributionItem {
  topicId: number;
  name: string;
  count: number;
}

export interface PassRate {
  passed: number;
  failed: number;
}

export interface SiteSettings {
  siteName: string;
  defaultLang: string;
  defaultTheme: string;
  examQuestionCount: number;
  examDurationMin: number;
  examMaxMistakes: number;
  realExamQuestionCount: number;
  realExamDurationMin: number;
  realExamMaxMistakes: number;
  /** "Guvohnomadan mahrum bo'lganlar" (50 savol) rejimi — mustaqil sozlanadi. */
  realExamRestoreMaxMistakes: number;
  realExamPrice: number;
  /** true bo'lsa — real imtihon bo'limi hech kim uchun ochilmaydi (sotib olish/boshlash). */
  realExamLocked: boolean;
  referralBonus: number;
  smartTestStreak: number;
  smartTestAdvicePercent: number;
  landingBadge: string;
  landingTitle: string;
  landingSubtitle: string;
  landingCta: string;
  landingTelegram: string;
  landingPhone: string;
}

export interface LandingData {
  siteName: string;
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  telegram: string;
  phone: string;
  stats: {
    questions: number;
    users: number;
    exams: number;
    passRate: number;
  };
}

// Real exam
export interface RealExamOption {
  optionId: string;
  text: LocalizedText;
}

export interface RealExamQuestion {
  questionId: string;
  imageUrl?: string | null;
  text: LocalizedText;
  options: RealExamOption[];
}

export interface RealExamStart {
  sessionId: string;
  durationSec: number;
  passMaxMistakes: number;
  questions: RealExamQuestion[];
}

export interface RealExamAnswerResponse {
  success: boolean;
  isCorrect: boolean;
  correctOptionId: string | null;
}

export interface RealExamResultItem {
  questionId: string;
  selectedOptionId?: string | null;
  correctOptionId: string | null;
  isCorrect: boolean;
}

export interface RealExamResult {
  sessionId: string;
  total: number;
  correct: number;
  mistakes: number;
  passed: boolean;
  results: RealExamResultItem[];
}

export interface ExamStart {
  sessionId: string;
  durationSec: number;
  questions: RealExamQuestion[];
}

export interface ExamResult {
  sessionId: string;
  total: number;
  correct: number;
  mistakes: number;
  passed: boolean;
  results: RealExamResultItem[];
}
