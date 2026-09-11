import { create } from "zustand";
import { shuffle } from "@/lib/utils";
import type { ContentLang, RealExamResult, RealExamStart } from "@/lib/types";

type Status = "idle" | "in_progress" | "finished";

interface RealExamState {
  session: RealExamStart | null;
  contentLang: ContentLang;
  currentIndex: number;
  timeLeftSec: number;
  endsAt: number; // wall-clock deadline (ms) — taymer real vaqtga bog'lanadi, tick soniga emas
  selected: Record<string, string>;
  confirmed: Record<string, boolean>;
  feedback: Record<string, { correctOptionId: string | null; isCorrect: boolean }>;
  shuffles: Record<string, string[]>;
  status: Status;
  result: RealExamResult | null;

  init: (session: RealExamStart, lang: ContentLang) => void;
  setLang: (lang: ContentLang) => void;
  visit: (index: number) => void;
  next: () => void;
  selectOption: (questionId: string, optionId: string) => void;
  confirm: (questionId: string) => void;
  setFeedback: (questionId: string, correctOptionId: string | null, isCorrect: boolean) => void;
  tick: () => void;
  setResult: (r: RealExamResult) => void;
  reset: () => void;
}

/**
 * Savolga KIRGANDA variant tartibini hisoblaydi.
 *
 * Qoida:
 *   * javobi hali TASDIQLANMAGAN savol — har safar kirganda variantlar QAYTA
 *     aralashadi (yodlab qolishning oldini oladi);
 *   * TASDIQLANGAN savol — tartibi qotib qoladi: javob qaysi F-raqamida
 *     tasdiqlangan bo'lsa, qaytib kelganda ham o'sha yerda turishi kerak.
 *
 * Qayta aralashganda o'sha savolning TANLOVI ham tozalanadi. Buni tushirib
 * qoldirib bo'lmaydi: aks holda foydalanuvchi eslab qolgan F-tugmasi endi
 * boshqa variantga tushadi va bitta bosishda XATO javob tasdiqlanib ketardi
 * (F-tugmani ikkinchi marta bosish = darhol tasdiqlash).
 *
 * Faqat savol ALMASHGANDA chaqiriladi — turgan savolning o'z tugmasini bosish
 * tartibni o'zgartirmaydi.
 */
function enterQuestion(
  state: RealExamState,
  index: number
): Partial<Pick<RealExamState, "shuffles" | "selected">> {
  const q = state.session?.questions[index];
  if (!q) return {};
  if (state.confirmed[q.questionId]) return {}; // tasdiqlangan — tegmaymiz

  const selected = { ...state.selected };
  delete selected[q.questionId];
  return {
    shuffles: {
      ...state.shuffles,
      [q.questionId]: shuffle(q.options.map((o) => o.optionId)),
    },
    selected,
  };
}

export const useRealExam = create<RealExamState>((set, get) => ({
  session: null,
  contentLang: "uz",
  currentIndex: 0,
  timeLeftSec: 0,
  endsAt: 0,
  selected: {},
  confirmed: {},
  feedback: {},
  shuffles: {},
  status: "idle",
  result: null,

  init: (session, lang) => {
    const first = session.questions[0];
    const shuffles: Record<string, string[]> = {};
    if (first) shuffles[first.questionId] = shuffle(first.options.map((o) => o.optionId));
    set({
      session,
      contentLang: lang,
      currentIndex: 0,
      timeLeftSec: session.durationSec,
      endsAt: Date.now() + session.durationSec * 1000,
      selected: {},
      confirmed: {},
      feedback: {},
      shuffles,
      status: "in_progress",
      result: null,
    });
  },

  setLang: (lang) => set({ contentLang: lang }),

  visit: (index) => {
    const state = get();
    if (!state.session) return;
    if (index < 0 || index >= state.session.questions.length) return;
    // Turgan savolning o'z raqamini bosish — hech narsa o'zgarmaydi (aks holda
    // ko'z oldida variantlar sakrab ketardi).
    if (index === state.currentIndex) return;
    set({ currentIndex: index, ...enterQuestion(state, index) });
  },

  next: () => {
    const state = get();
    if (!state.session) return;
    const nextIndex = Math.min(state.currentIndex + 1, state.session.questions.length - 1);
    if (nextIndex === state.currentIndex) return; // oxirgi savolda turibmiz
    set({ currentIndex: nextIndex, ...enterQuestion(state, nextIndex) });
  },

  selectOption: (questionId, optionId) => {
    const state = get();
    if (state.confirmed[questionId]) return;
    set({ selected: { ...state.selected, [questionId]: optionId } });
  },

  confirm: (questionId) =>
    set((state) => ({ confirmed: { ...state.confirmed, [questionId]: true } })),

  setFeedback: (questionId, correctOptionId, isCorrect) =>
    set((state) => ({
      feedback: { ...state.feedback, [questionId]: { correctOptionId, isCorrect } },
    })),

  // Real vaqtdan hisoblanadi (Date.now) — fon rejimida/throttlingda tick sekinlashsa ham
  // qaytganda darhol to'g'ri vaqtni ko'rsatadi (tick sonini emas, o'tgan vaqtni sanaydi).
  tick: () =>
    set((state) => ({
      timeLeftSec: state.endsAt
        ? Math.max(0, Math.round((state.endsAt - Date.now()) / 1000))
        : Math.max(0, state.timeLeftSec - 1),
    })),

  setResult: (r) => set({ result: r, status: "finished" }),

  reset: () =>
    set({
      session: null,
      currentIndex: 0,
      timeLeftSec: 0,
      endsAt: 0,
      selected: {},
      confirmed: {},
      feedback: {},
      shuffles: {},
      status: "idle",
      result: null,
    }),
}));
