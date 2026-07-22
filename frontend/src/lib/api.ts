import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type {
  DashboardSummary,
  ExamResult,
  ExamStart,
  LandingData,
  LocalizedText,
  MeStats,
  Payment,
  PaymentList,
  PaymentMethod,
  PassRate,
  Question,
  QuestionList,
  RealExamAnswerResponse,
  RealExamResult,
  RealExamStart,
  ReferralStats,
  SiteSettings,
  Tariff,
  Timeseries,
  TokenResponse,
  Topic,
  TopicDistributionItem,
  UserList,
  UserProfile,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export const TOKEN_KEY = "pp_token";
export const REFRESH_KEY = "pp_refresh";
export const ADMIN_TOKEN_KEY = "pp_admin_token";

export const api = axios.create({
  baseURL: API_URL,
  // ngrok bepul tunnel API'ni birinchi so'rovda "browser warning" HTML sahifasi bilan
  // to'sib qo'yadi. Bu header o'sha ogohlantirishni chetlab o'tadi (JSON to'g'ridan keladi).
  // Oddiy (Render/prod) backend uchun zararsiz — e'tiborsiz qoldiriladi.
  headers: { "ngrok-skip-browser-warning": "true" },
});

api.interceptors.request.use((config) => {
  const url = config.url || "";
  const isAdmin = url.includes("/admin/") && !url.includes("/admin/auth/login");
  const token = isAdmin
    ? localStorage.getItem(ADMIN_TOKEN_KEY)
    : localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Token refresh (401 → /auth/refresh → asl so'rovni qayta yuborish) ----
// Access token ~30 daqiqada tugaydi. Tugaganda foydalanuvchini chiqarib yubormasdan,
// refresh token bilan jimgina yangilaymiz va asl so'rovni qayta yuboramiz. Bir vaqtda
// kelgan bir nechta 401 uchun faqat BITTA refresh bo'ladi (qolganlari navbatda kutadi).
let isRefreshing = false;
let refreshWaiters: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null) {
  refreshWaiters.forEach((cb) => cb(token));
  refreshWaiters = [];
}

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/register") ||
    url.includes("/auth/verify") ||
    url.includes("/auth/reset") ||
    url.includes("/auth/forgot") ||
    url.includes("/admin/auth/login")
  );
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = original?.url || "";

    // Akkaunt bloklangan (xavfsizlik tizimi) -> sessiyani DARHOL tugatib, sahifani
    // yangilab (to'liq reload), login'ga chiqaramiz. Ogohlantirish login'da ko'rsatiladi.
    // Brauzer orqali hujum (URL yoki so'rov tanasida) shu 403'ni qaytaradi.
    if (status === 403 && !url.includes("/admin/") && !isAuthEndpoint(url)) {
      const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
      if (typeof detail === "string" && /blok/i.test(detail)) {
        // Barcha sessiya izlari o'chiriladi (in-memory holat reload bilan reset bo'ladi)
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        sessionStorage.setItem("pp_block_msg", detail);
        // replace -> orqaga qaytib bloklangan sahifaga kira olmaydi; to'liq reload = "sayt yangilanadi"
        if (!location.pathname.startsWith("/login")) {
          location.replace("/login");
        } else {
          location.reload();
        }
        return Promise.reject(error);
      }
    }

    // Admin oqimida refresh yo'q — tokenni o'chirib, login'ga yo'naltiramiz (store desync bo'lmasin).
    // Bitta umumiy login: alohida /admin/login sahifasi yo'q, asosiy /login'ga qaytariladi.
    if (status === 401 && url.includes("/admin/") && !isAuthEndpoint(url)) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      if (!location.pathname.startsWith("/login")) {
        location.replace("/login");
      }
      return Promise.reject(error);
    }

    // Faqat foydalanuvchi 401'ida, auth endpointi bo'lmasa va hali urinilmagan bo'lsa
    if (status !== 401 || !original || original._retry || isAuthEndpoint(url)) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) {
      localStorage.removeItem(TOKEN_KEY);
      return Promise.reject(error);
    }

    original._retry = true;

    // Boshqa so'rov allaqachon refresh qilyapti — yangi token kelguncha kutamiz
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshWaiters.push((token) => {
          if (!token) return reject(error);
          resolve(api(original)); // request interceptor yangi tokenni qo'yadi
        });
      });
    }

    isRefreshing = true;
    try {
      // Asl `api` emas, toza axios — interceptor rekursiyaga tushmasin
      const { data } = await axios.post<TokenResponse>(`${API_URL}/auth/refresh`, {
        refreshToken,
      });
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
      onRefreshed(data.accessToken);
      return api(original); // request interceptor yangilangan tokenni qo'yadi
    } catch (refreshErr) {
      onRefreshed(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      // Refresh ham tugadi -> haqiqatan chiqarilgan. Login'ga yo'naltiramiz (to'liq reload
      // in-memory holat va query keshini tozalaydi -> UI "kirilgan"dek qotib qolmaydi).
      if (
        !location.pathname.startsWith("/login") &&
        !location.pathname.startsWith("/admin")
      ) {
        location.replace("/login");
      }
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

/** Xato haqiqiy auth muvaffaqiyatsizligimi (401/403)? Tarmoq/5xx xatolari EMAS.
 *  Guard'lar shu bilan: faqat auth xatosida logout, offline/server xatosida — qayta urinish. */
export function isAuthError(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    (error.response?.status === 401 || error.response?.status === 403)
  );
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
    return error.message;
  }
  return "Noma'lum xatolik yuz berdi";
}

export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_ORIGIN}${path}`;
}

// ---------------- Auth ----------------
export const authApi = {
  // 1-qadam: forma -> pending saqlanadi, Telegram tasdiq kerak
  registerInit: (data: {
    firstName: string;
    lastName: string;
    nickname: string;
    password: string;
    ref?: string;
  }) =>
    api
      .post<{
        ok: boolean;
        nickname: string;
        botUsername: string;
        channel: string;
      }>("/auth/register-init", data)
      .then((r) => r.data),
  // 2-qadam: Telegram'dan kelgan kod -> profil ochiladi
  verifyCode: (data: { nickname: string; code: string }) =>
    api.post<TokenResponse>("/auth/verify-code", data).then((r) => r.data),
  // Parolni tiklash 1-qadam: nik mavjudligi + bot ma'lumoti
  forgotInit: (nickname: string) =>
    api
      .post<{
        ok: boolean;
        nickname: string;
        botUsername: string;
        channel: string;
      }>("/auth/forgot-init", { nickname })
      .then((r) => r.data),
  // Parolni tiklash: kodni tekshirish (yangi parol bosqichidan oldin)
  verifyReset: (data: { nickname: string; code: string }) =>
    api.post<{ ok: boolean }>("/auth/verify-reset", data).then((r) => r.data),
  // Parolni tiklash: yangi parol o'rnatish (avto-login)
  resetPassword: (data: { nickname: string; code: string; newPassword: string }) =>
    api.post<TokenResponse>("/auth/reset-password", data).then((r) => r.data),
  // Akkauntni butunlay o'chirish (Telegram kodi bilan tasdiqlangach)
  deleteAccount: (data: { nickname: string; code: string }) =>
    api.post<{ ok: boolean }>("/auth/delete-account", data).then((r) => r.data),
  // Parolni o'zgartirish (kirgan foydalanuvchi — joriy parol bilan)
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    api.post<{ ok: boolean }>("/auth/change-password", data).then((r) => r.data),
  // Promokod (taklif kodi) haqiqiyligini tekshirish — ro'yxatda
  checkPromo: (code: string) =>
    api
      .post<{ valid: boolean; name?: string }>("/auth/check-promo", { code })
      .then((r) => r.data),
  // Teskari sanoq uchun: amaldagi kod bor-yo'qligi va qolgan soniya
  codeStatus: (nickname: string) =>
    api
      .post<{ active: boolean; remainingSeconds: number; purpose?: string }>(
        "/auth/code-status",
        { nickname }
      )
      .then((r) => r.data),
  login: (data: { nickname: string; password: string }) =>
    api.post<TokenResponse>("/auth/login", data).then((r) => r.data),
  checkNickname: (nickname: string) =>
    api
      .post<{ available: boolean; error?: string }>("/auth/check-nickname", {
        nickname,
      })
      .then((r) => r.data),
  me: () => api.get<UserProfile>("/auth/me").then((r) => r.data),
  updateMe: (data: Partial<UserProfile>) =>
    api.patch<UserProfile>("/auth/me", data).then((r) => r.data),
  adminLogin: (data: { login: string; password: string }) =>
    api.post<TokenResponse>("/admin/auth/login", data).then((r) => r.data),
  // Joriy adminning o'z login(i) — /admin/ prefiksli (admin-token bilan yuboriladi)
  adminMe: () =>
    api.get<{ ok: boolean; login: string }>("/admin/auth/me").then((r) => r.data),
  // Admin o'z login/parolini o'zgartiradi (ikkalasi ham ixtiyoriy, kamida bittasi kerak)
  adminUpdateCredentials: (data: {
    currentPassword: string;
    newLogin?: string;
    newPassword?: string;
  }) =>
    api
      .patch<{ ok: boolean; login: string }>("/admin/auth/credentials", data)
      .then((r) => r.data),
};

// ---------------- Landing (public guest panel) ----------------
export const landingApi = {
  get: () => api.get<LandingData>("/landing").then((r) => r.data),
};

// ---------------- Topics ----------------
export const topicsApi = {
  list: () => api.get<Topic[]>("/topics").then((r) => r.data),
  create: (data: Partial<Topic>) =>
    api.post<Topic>("/admin/topics", data).then((r) => r.data),
  update: (id: number, data: Partial<Topic>) =>
    api.put<Topic>(`/admin/topics/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/admin/topics/${id}`).then((r) => r.data),
};

// ---------------- Questions ----------------
// Backend savollarni partiyalab beradi (limit 20, anti-scraping). Mashq UI'si to'liq
// ro'yxatni kutadi -> bu yerda partiyalarni yig'ib, bitta massiv qaytaramiz (UI o'zgarmaydi).
async function fetchPagedQuestions(path: string): Promise<Question[]> {
  const PAGE = 20;
  const all: Question[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await api.get<Question[]>(path, { params: { limit: PAGE, offset } });
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

export const questionsApi = {
  byTopic: (topicId: number) => fetchPagedQuestions(`/topics/${topicId}/questions`),
  random: (count: number) =>
    api
      .get<Question[]>("/random-questions", { params: { count } })
      .then((r) => r.data),
  // Mashq javobini SERVER tomonida tekshirish (to'g'ri javob oldindan ko'rinmaydi)
  checkAnswer: (questionId: string, optionId: string) =>
    api
      .post<{
        isCorrect: boolean;
        correctOptionId: string | null;
        explanation: LocalizedText | null;
      }>("/check-answer", { questionId, optionId })
      .then((r) => r.data),
  get: (id: string) => api.get<Question>(`/questions/${id}`).then((r) => r.data),
  adminList: (params: { topicId?: number; search?: string; page?: number }) =>
    api
      .get<QuestionList>("/admin/questions", {
        params: { topic_id: params.topicId, search: params.search, page: params.page },
      })
      .then((r) => r.data),
  check: (text: string) =>
    api
      .post<{ exists: boolean; duplicateText?: string | null }>("/admin/questions/check", { text })
      .then((r) => r.data),
  translate: (texts: string[]) =>
    api
      .post<{ translations: string[]; ok: boolean }>("/admin/questions/translate", { texts })
      .then((r) => r.data),
  create: (data: unknown) =>
    api.post<Question>("/admin/questions", data).then((r) => r.data),
  update: (id: string, data: unknown) =>
    api.put<Question>(`/admin/questions/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/admin/questions/${id}`).then((r) => r.data),
  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ imageUrl: string }>(`/admin/questions/${id}/image`, form)
      .then((r) => r.data);
  },
};

// ---------------- Tickets (bilet) ----------------
export const ticketsApi = {
  list: () =>
    api.get<{ number: number; count: number }[]>("/tickets").then((r) => r.data),
  questions: (n: number) => fetchPagedQuestions(`/tickets/${n}/questions`),
};

// ---------------- Yo'l belgilari (road signs) ----------------
export interface RoadSign {
  code: string;
  name: { uz: string; kaa: string; ru: string };
  imageUrl: string;
}
export interface RoadSignCategory {
  code: string;
  category: { uz: string; kaa: string; ru: string };
  count: number;
  signs: RoadSign[];
}
export interface RoadSignsData {
  title: { uz: string; kaa: string; ru: string };
  languages: string[];
  totalSigns: number;
  imagesBase: string;
  categories: RoadSignCategory[];
}
export const roadSignsApi = {
  get: () => api.get<RoadSignsData>("/road-signs").then((r) => r.data),
};

// ---------------- Exam / Real exam ----------------
export const examApi = {
  start: (data: { topicId?: number; kind?: string; count?: number }) =>
    api.post<ExamStart>("/exam/start", data).then((r) => r.data),
  submit: (sessionId: string, answers: { questionId: string; optionId?: string }[]) =>
    api.post<ExamResult>(`/exam/${sessionId}/submit`, { answers }).then((r) => r.data),
};

export const realExamApi = {
  // Narx + to'langan (ishlatilmagan) kirish bormi
  info: () =>
    api
      .get<{ price: number; hasAccess: boolean; bonus: number; locked: boolean }>(
        "/real-exam/info"
      )
      .then((r) => r.data),
  // Chegirma promokodini tekshiradi — to'lovdan oldin chegirmali narxni ko'rsatish uchun.
  checkPromo: (code: string) =>
    api
      .post<{
        valid: boolean;
        discountPercent: number;
        discountedPrice: number;
        reason?: string | null;
      }>("/real-exam/check-promo", { code })
      .then((r) => r.data),
  // Bir martalik kirishni sotib olish (darhol ochiladi). promoCode — ixtiyoriy chegirma.
  purchase: (method?: string, promoCode?: string) =>
    api
      .post<{ ok: boolean; price: number; discountPercent: number }>(
        "/real-exam/purchase",
        { method, promoCode }
      )
      .then((r) => r.data),
  start: (count?: number) =>
    api.post<RealExamStart>("/real-exam/start", { count }).then((r) => r.data),
  answer: (sessionId: string, questionId: string, optionId: string) =>
    api
      .post<RealExamAnswerResponse>(`/real-exam/${sessionId}/answer`, {
        questionId,
        optionId,
      })
      .then((r) => r.data),
  finish: (sessionId: string) =>
    api.post<RealExamResult>(`/real-exam/${sessionId}/finish`).then((r) => r.data),
};

// ---------------- Smart test (aqlli test) ----------------
export interface SmartInfo {
  streak: number;
  advicePercent: number;
  attempted: number;
  known: number;
  unknown: number;
  unknownPercent: number;
  advise: boolean;
}
export interface SmartQuestion {
  questionId: string;
  imageUrl: string | null;
  text: LocalizedText;
  options: { optionId: string; text: LocalizedText }[];
  streak: number;
}
export interface SmartStart {
  streakTarget: number;
  questions: SmartQuestion[];
}
export interface SmartAnswer {
  isCorrect: boolean;
  correctOptionId: string | null;
  streak: number;
  mastered: boolean;
  streakTarget: number;
  explanation: LocalizedText | null;
}

export const smartTestApi = {
  info: () => api.get<SmartInfo>("/smart-test/info").then((r) => r.data),
  start: (count?: number) =>
    api.post<SmartStart>("/smart-test/start", { count }).then((r) => r.data),
  answer: (questionId: string, optionId: string) =>
    api
      .post<SmartAnswer>("/smart-test/answer", { questionId, optionId })
      .then((r) => r.data),
};

// ---------------- Me ----------------
export const meApi = {
  stats: () => api.get<MeStats>("/me/stats").then((r) => r.data),
  mistakes: () => api.get<Question[]>("/me/mistakes").then((r) => r.data),
  favorites: () => api.get<Question[]>("/me/favorites").then((r) => r.data),
  toggleFavorite: (questionId: string) =>
    api.post<{ favorite: boolean }>("/me/favorites", { questionId }).then((r) => r.data),
  addMistake: (questionId: string) =>
    api.post("/me/mistakes", { questionId }).then((r) => r.data),
  clearMistakes: () =>
    api.delete<{ cleared: number }>("/me/mistakes").then((r) => r.data),
  referral: () => api.get<ReferralStats>("/me/referral").then((r) => r.data),
};

// ---------------- Tariffs / payment methods ----------------
export const tariffsApi = {
  listActive: () => api.get<Tariff[]>("/tariffs").then((r) => r.data),
  adminList: () => api.get<Tariff[]>("/admin/tariffs").then((r) => r.data),
  create: (data: Partial<Tariff>) =>
    api.post<Tariff>("/admin/tariffs", data).then((r) => r.data),
  update: (id: string, data: Partial<Tariff>) =>
    api.put<Tariff>(`/admin/tariffs/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/admin/tariffs/${id}`).then((r) => r.data),
};

export const paymentMethodsApi = {
  listEnabled: () => api.get<PaymentMethod[]>("/payment-methods").then((r) => r.data),
  adminList: () => api.get<PaymentMethod[]>("/admin/payment-methods").then((r) => r.data),
  update: (id: string, data: Partial<PaymentMethod>) =>
    api.patch<PaymentMethod>(`/admin/payment-methods/${id}`, data).then((r) => r.data),
};

// ---------------- Payments ----------------
export const paymentsApi = {
  create: (data: { tariffId: string; phone: string; method: string }) =>
    api.post<Payment>("/payments", data).then((r) => r.data),
  adminList: (page = 1) =>
    api.get<PaymentList>("/admin/payments", { params: { page } }).then((r) => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch<Payment>(`/admin/payments/${id}`, { status }).then((r) => r.data),
};

// ---------------- Chegirma promokodlari (admin) — real imtihon narxiga foizli chegirma ----------------
export interface PromoCode {
  id: string;
  code: string;
  discountPercent: number;
  isActive: boolean;
  usedCount: number;
  createdAt: string;
}
export const promoCodesApi = {
  adminList: () => api.get<PromoCode[]>("/admin/promo-codes").then((r) => r.data),
  create: (data: { code: string; discountPercent: number }) =>
    api.post<PromoCode>("/admin/promo-codes", data).then((r) => r.data),
  update: (id: string, data: { discountPercent?: number; isActive?: boolean }) =>
    api.patch<PromoCode>(`/admin/promo-codes/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/admin/promo-codes/${id}`).then((r) => r.data),
};

// ---------------- Users (admin) ----------------
export const usersApi = {
  list: (params: { search?: string; page?: number }) =>
    api.get<UserList>("/admin/users", { params }).then((r) => r.data),
  update: (id: string, data: { isBlocked?: boolean }) =>
    api.patch<UserProfile>(`/admin/users/${id}`, data).then((r) => r.data),
  unbindTelegram: (id: string) =>
    api
      .post<UserProfile>(`/admin/users/${id}/unbind-telegram`)
      .then((r) => r.data),
};

// ---------------- Ustoz (maslahat) tizimi ----------------
export interface TeacherTariff {
  id: string;
  days: number;
  price: number;
  isActive: boolean;
}
export interface TeacherPublic {
  id: string;
  name: string;
  surname?: string | null;
  experienceYears: number;
  tariffs: TeacherTariff[];
  hasAccess: boolean;
  accessExpiresAt?: string | null;
  /** Joriy user bilan suhbat holati (thread mavjud bo'lsagina) — bildirishnoma uchun. */
  threadAwaitingReply?: boolean | null;
  threadLastMsgAt?: string | null;
}
export interface ChatMsg {
  id: string;
  sender: "user" | "teacher";
  text?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: "image" | "file" | null;
  editedAt?: string | null;
  createdAt: string;
}
/** Admin moderatsiya ko'rinishi — o'chirilgan/flagged xabarlar ham keladi. */
export interface AdminChatMsg extends ChatMsg {
  deletedAt?: string | null;
  flagged?: boolean;
  hasLink?: boolean;
}
export interface TeacherChat {
  threadId: string;
  canSend: boolean;
  accessExpiresAt?: string | null;
  messages: ChatMsg[];
}
export interface TeacherThread {
  id: string;
  userName: string;
  userNickname?: string | null;
  awaitingReply: boolean;
  lastMsgAt?: string | null;
  lastText?: string | null;
}
export interface TeacherAdmin {
  id: string;
  userId: string;
  name: string;
  surname?: string | null;
  phone: string;
  telegram?: string | null;
  nickname?: string | null;
  experienceYears: number;
  isActive: boolean;
  createdAt: string;
  tariffs: TeacherTariff[];
}
export interface AdminChatThread {
  id: string;
  userName: string;
  userNickname?: string | null;
  teacherName: string;
  lastMsgAt?: string | null;
  lastText?: string | null;
  flaggedCount: number;
}
export interface AdminFlaggedMsg {
  id: string;
  threadId: string;
  sender: string;
  senderName: string;
  text?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  hasLink: boolean;
  hasPhone: boolean;
  createdAt: string;
}
export interface ChatSendPayload {
  text?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: "image" | "file";
}

export const teachersApi = {
  list: () => api.get<TeacherPublic[]>("/teachers").then((r) => r.data),
  purchase: (teacherId: string, tariffId: string, method?: string) =>
    api
      .post<{ ok: boolean; expiresAt: string }>(`/teachers/${teacherId}/purchase`, {
        tariffId,
        method,
      })
      .then((r) => r.data),
  chat: (teacherId: string) =>
    api.get<TeacherChat>(`/teachers/${teacherId}/chat`).then((r) => r.data),
  send: (teacherId: string, data: ChatSendPayload) =>
    api.post<ChatMsg>(`/teachers/${teacherId}/chat`, data).then((r) => r.data),
  editMsg: (teacherId: string, messageId: string, text: string) =>
    api
      .patch<ChatMsg>(`/teachers/${teacherId}/chat/${messageId}`, { text })
      .then((r) => r.data),
  deleteMsg: (teacherId: string, messageId: string) =>
    api.delete(`/teachers/${teacherId}/chat/${messageId}`).then((r) => r.data),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string; name: string; type: "image" | "file" }>("/chat-upload", form)
      .then((r) => r.data);
  },
};

export const teacherPanelApi = {
  threads: () => api.get<TeacherThread[]>("/teacher/threads").then((r) => r.data),
  messages: (threadId: string) =>
    api.get<ChatMsg[]>(`/teacher/threads/${threadId}/messages`).then((r) => r.data),
  reply: (threadId: string, data: ChatSendPayload) =>
    api.post<ChatMsg>(`/teacher/threads/${threadId}/messages`, data).then((r) => r.data),
  editMsg: (threadId: string, messageId: string, text: string) =>
    api
      .patch<ChatMsg>(`/teacher/threads/${threadId}/messages/${messageId}`, { text })
      .then((r) => r.data),
  deleteMsg: (threadId: string, messageId: string) =>
    api.delete(`/teacher/threads/${threadId}/messages/${messageId}`).then((r) => r.data),
  changeLogin: (newLogin: string, password: string) =>
    api
      .post<{ ok: boolean; login: string }>("/teacher/change-login", {
        newLogin,
        password,
      })
      .then((r) => r.data),
};

export const adminTeachersApi = {
  list: () => api.get<TeacherAdmin[]>("/admin/teachers").then((r) => r.data),
  create: (data: {
    name: string;
    surname: string;
    phone: string;
    telegram?: string;
    experienceYears: number;
    login: string;
    password: string;
    passwordConfirm: string;
  }) => api.post<TeacherAdmin>("/admin/teachers", data).then((r) => r.data),
  update: (id: string, data: Partial<TeacherAdmin>) =>
    api.patch<TeacherAdmin>(`/admin/teachers/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/admin/teachers/${id}`).then((r) => r.data),
  addTariff: (teacherId: string, data: { days: number; price: number }) =>
    api
      .post<TeacherTariff>(`/admin/teachers/${teacherId}/tariffs`, data)
      .then((r) => r.data),
  removeTariff: (teacherId: string, tariffId: string) =>
    api.delete(`/admin/teachers/${teacherId}/tariffs/${tariffId}`).then((r) => r.data),
  chats: () => api.get<AdminChatThread[]>("/admin/teacher-chats").then((r) => r.data),
  chatMessages: (threadId: string) =>
    api.get<AdminChatMsg[]>(`/admin/teacher-chats/${threadId}`).then((r) => r.data),
  flags: () => api.get<AdminFlaggedMsg[]>("/admin/teacher-flags").then((r) => r.data),
  dismissFlag: (messageId: string) =>
    api.delete(`/admin/teacher-flags/${messageId}`).then((r) => r.data),
};

// ---------------- Settings (admin) ----------------
export const settingsApi = {
  get: () => api.get<SiteSettings>("/admin/settings").then((r) => r.data),
  update: (data: Partial<SiteSettings>) =>
    api.patch<SiteSettings>("/admin/settings", data).then((r) => r.data),
};

// ---------------- Dashboard (admin) ----------------
export const dashboardApi = {
  summary: () =>
    api.get<DashboardSummary>("/admin/dashboard/summary").then((r) => r.data),
  timeseries: (range: string) =>
    api
      .get<Timeseries>("/admin/dashboard/timeseries", { params: { range } })
      .then((r) => r.data),
  topicsDistribution: () =>
    api
      .get<{ items: TopicDistributionItem[] }>("/admin/dashboard/topics-distribution")
      .then((r) => r.data),
  passRate: () =>
    api.get<PassRate>("/admin/dashboard/exam-pass-rate").then((r) => r.data),
  referral: () =>
    api
      .get<{
        totalInvited: number;
        totalPaid: number;
        totalBonus: number;
        bonusPerReferral: number;
      }>("/admin/referral")
      .then((r) => r.data),
};
