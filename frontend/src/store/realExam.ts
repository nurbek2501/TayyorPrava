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

function reshuffleFor(state: RealExamState, index: number): Record<string, string[]> {
  const q = state.session?.questions[index];
  if (!q) return state.shuffles;
  // Variant tartibi savol uchun FAQAT BIR MARTA (birinchi ko'rilganda) yaratiladi va
  // keyin barqaror qoladi. Aks holda tanlangan (lekin hali tasdiqlanmagan) savolga
  // qaytilganda variantlar qayta aralashib, `selected` optionId boshqa F-raqamiga
  // tushardi — foydalanuvchi eslagan F-tugmani bossa xato variant tasdiqlanardi.
  if (state.shuffles[q.questionId]) return state.shuffles;
  return {
    ...state.shuffles,
    [q.questionId]: shuffle(q.options.map((o) => o.optionId)),
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
    set({ currentIndex: index, shuffles: reshuffleFor(state, index) });
  },

  next: () => {
    const state = get();
    if (!state.session) return;
    const nextIndex = Math.min(state.currentIndex + 1, state.session.questions.length - 1);
    set({ currentIndex: nextIndex, shuffles: reshuffleFor(state, nextIndex) });
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
