import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Flame,
  Lightbulb,
  Radio,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { assetUrl, getErrorMessage, smartTestApi } from "@/lib/api";
import type { SmartAnswer, SmartInfo, SmartQuestion } from "@/lib/api";
import { pickText } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";
import { ContentLangSwitcher } from "@/components/shared/ContentLangSwitcher";
import { ZoomableImage } from "@/components/ui/ZoomableImage";
import { PageLoader } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";
import type { ContentLang, UiLang } from "@/lib/types";

const NO_IMAGE_SRC = "/no-image-car.webp";

const SMART_T: Record<
  UiLang,
  {
    name: string;
    desc: string;
    back: string;
    unknownLabel: string;
    masteredLabel: string;
    note: (n: number) => string;
    start: string;
    loading: string;
    adviceTitle: string;
    adviceText: string;
    adviceBtn: string;
    correct: string;
    wrong: string;
    mastered: string;
    masteredDesc: string;
    streakLabel: string;
    sessionMastered: string;
    explanationLabel: string;
    prev: string;
    next: string;
    allDoneTitle: string;
    allDoneDesc: string;
    again: string;
    home: string;
  }
> = {
  uz: {
    name: "Aqlli test",
    desc: "Savollar tasodifiy keladi — har birini ketma-ket to'g'ri yeching.",
    back: "Asosiy bo'lim",
    unknownLabel: "Bilmagan savollar",
    masteredLabel: "o'zlashtirilgan",
    note: (n) =>
      `Savollar tasodifiy, vaqt cheklovsiz. Har savolni ${n} marta ketma-ket to'g'ri yechsangiz — u qayta tushmaydi.`,
    start: "Boshlash",
    loading: "Yuklanmoqda...",
    adviceTitle: "Siz tayyorsiz! 🎯",
    adviceText:
      "Savollarning ko'pchiligini bilasiz. Xohlasangiz, bitta real imtihon topshirib ko'ring — majburiy emas.",
    adviceBtn: "Real imtihon",
    correct: "To'g'ri!",
    wrong: "Noto'g'ri",
    mastered: "O'zlashtirildi!",
    masteredDesc: "Bu savol endi qayta tushmaydi 🎉",
    streakLabel: "Ketma-ket to'g'ri",
    sessionMastered: "o'zlashtirildi",
    explanationLabel: "Izoh",
    prev: "Oldingi",
    next: "Keyingi savol",
    allDoneTitle: "Barakalla! 🏆",
    allDoneDesc: "Barcha savollarni o'zlashtirdingiz!",
    again: "Yana mashq",
    home: "Bosh sahifa",
  },
  kr: {
    name: "Ақлли тест",
    desc: "Саволлар тасодифий келади — ҳар бирини кетма-кет тўғри ечинг.",
    back: "Асосий бўлим",
    unknownLabel: "Билмаган саволлар",
    masteredLabel: "ўзлаштирилган",
    note: (n) =>
      `Саволлар тасодифий, вақт чекловсиз. Ҳар саволни ${n} марта кетма-кет тўғри ечсангиз — у қайта тушмайди.`,
    start: "Бошлаш",
    loading: "Юкланмоқда...",
    adviceTitle: "Сиз тайёрсиз! 🎯",
    adviceText:
      "Саволларнинг кўпчилигини биласиз. Хоҳласангиз, битта реал имтиҳон топшириб кўринг — мажбурий эмас.",
    adviceBtn: "Реал имтиҳон",
    correct: "Тўғри!",
    wrong: "Нотўғри",
    mastered: "Ўзлаштирилди!",
    masteredDesc: "Бу савол энди қайта тушмайди 🎉",
    streakLabel: "Кетма-кет тўғри",
    sessionMastered: "ўзлаштирилди",
    explanationLabel: "Изоҳ",
    prev: "Олдинги",
    next: "Кейинги савол",
    allDoneTitle: "Баракалла! 🏆",
    allDoneDesc: "Барча савролларни ўзлаштирдингиз!",
    again: "Яна машқ",
    home: "Бош саҳифа",
  },
  ru: {
    name: "Умный тест",
    desc: "Вопросы приходят случайно — отвечайте на каждый правильно подряд.",
    back: "Главный раздел",
    unknownLabel: "Неизвестные вопросы",
    masteredLabel: "освоено",
    note: (n) =>
      `Вопросы случайные, без времени. Ответьте на каждый вопрос правильно ${n} раз подряд — и он больше не появится.`,
    start: "Начать",
    loading: "Загрузка...",
    adviceTitle: "Вы готовы! 🎯",
    adviceText:
      "Вы знаете большинство вопросов. При желании попробуйте реальный экзамен — это необязательно.",
    adviceBtn: "Реальный экзамен",
    correct: "Верно!",
    wrong: "Неверно",
    mastered: "Освоено!",
    masteredDesc: "Этот вопрос больше не появится 🎉",
    streakLabel: "Подряд верно",
    sessionMastered: "освоено",
    explanationLabel: "Пояснение",
    prev: "Предыдущий",
    next: "Следующий вопрос",
    allDoneTitle: "Отлично! 🏆",
    allDoneDesc: "Вы освоили все вопросы!",
    again: "Ещё практика",
    home: "Главная",
  },
};

// Bir savolning ko'rish holati — orqaga/oldinga navigatsiyada tiklanadi
// (javob berilgan savol qayta ochilganda yashil/qizil holati saqlanadi).
type ViewState = {
  selected: string | null;
  feedback: SmartAnswer | null;
  wrongPicks: string[];
  solvedQ: boolean;
};

function pickRandom(arr: SmartQuestion[], excludeId: string | null): SmartQuestion | null {
  const pool = arr.length > 1 && excludeId ? arr.filter((q) => q.questionId !== excludeId) : arr;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// To'liq ekran gradient foni (binafsha/fuksiya blob'lar).
function GradientBg() {
  return (
    <>
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-fuchsia-700/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-0 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
    </>
  );
}

// «Asosiy bo'lim» tugmasi — chiroyli glassy pill + gradient ikonka.
function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-2.5 rounded-full border border-line/15 bg-card/70 py-1.5 pl-1.5 pr-4 text-sm font-bold text-ink shadow-glass backdrop-blur-xl transition hover:border-violet-500/40 hover:bg-card"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-glow transition-transform group-hover:-translate-x-0.5">
        <ArrowLeft className="h-4 w-4" />
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export function SmartTestPage() {
  const navigate = useNavigate();
  const uiLang = useUiStore((s) => s.uiLang);
  const uiContentLang = useUiStore((s) => s.contentLang);
  const tt = SMART_T[uiLang] ?? SMART_T.uz;

  const [phase, setPhase] = useState<"entry" | "drill" | "done">("entry");
  const [info, setInfo] = useState<SmartInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [contentLang, setContentLang] = useState<ContentLang>(
    uiContentLang === "ru" ? "uz" : uiContentLang
  );
  const [pool, setPool] = useState<SmartQuestion[]>([]);
  const [streakTarget, setStreakTarget] = useState(5);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  // Ko'rilgan savollar ketma-ketligi (tarix) — orqaga/oldinga navigatsiya uchun.
  // current = history[histIndex]. Chiziqli indeks yo'q (tasodifiy mashq), shuning
  // uchun "orqaga" avval ko'rilgan savolga qaytadi, "oldinga" — keyingisiga (yoki yangi).
  const [history, setHistory] = useState<SmartQuestion[]>([]);
  const [histIndex, setHistIndex] = useState(0);
  // Ko'rish holatlari POZITSIYA (histIndex) bo'yicha kalitlanadi — questionId emas.
  // Bir savol streak uchun tarixda bir necha pozitsiyada uchrashi mumkin; har pozitsiya
  // o'z holatini (yashil/yechilgan) mustaqil saqlaydi.
  const [views, setViews] = useState<Record<number, ViewState>>({});
  // O'zlashtirilgan (mastered) savollar — navigatsiyada o'tkazib yuboriladi (qayta so'ralmaydi).
  const masteredIdsRef = useRef<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SmartAnswer | null>(null);
  const [answering, setAnswering] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  // Xato bosilgan variantlar (qizil qoladi) va "yechildi" holati (to'g'risi bosildi)
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const [solvedQ, setSolvedQ] = useState(false);

  const current = history[histIndex] ?? null;

  // Avto-o'tish taymeri — to'g'ri javobdan keyin keyingi savolga o'zi o'tadi
  const advanceTimer = useRef<number | null>(null);
  // Klaviatura (F6/F7) doim eng oxirgi navigatsiya funksiyasini chaqirishi uchun ref.
  const navRef = useRef<{ back: () => void; forward: () => void }>({
    back: () => {},
    forward: () => {},
  });
  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    []
  );

  // F6 — oldingi savol, F7 — keyingi savol (boshqa test bo'limlaridagi kabi).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F6") {
        e.preventDefault();
        navRef.current.back();
      } else if (e.key === "F7") {
        e.preventDefault();
        navRef.current.forward();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const snapshot = (): ViewState => ({ selected, feedback, wrongPicks, solvedQ });
  const applyView = (v?: ViewState) => {
    setSelected(v?.selected ?? null);
    setFeedback(v?.feedback ?? null);
    setWrongPicks(v?.wrongPicks ?? []);
    setSolvedQ(v?.solvedQ ?? false);
  };

  const loadInfo = () => smartTestApi.info().then(setInfo).catch(() => {});
  useEffect(() => {
    loadInfo();
  }, []);

  const seedStreaks = (qs: SmartQuestion[]) =>
    setStreaks((prev) => {
      const m = { ...prev };
      qs.forEach((q) => (m[q.questionId] = q.streak));
      return m;
    });

  const start = async () => {
    setLoading(true);
    try {
      const s = await smartTestApi.start();
      if (!s.questions.length) {
        setPhase("done");
        return;
      }
      setStreaks({});
      seedStreaks(s.questions);
      setPool(s.questions);
      setStreakTarget(s.streakTarget);
      setMasteredCount(0);
      const first = pickRandom(s.questions, null);
      setViews({});
      masteredIdsRef.current = new Set();
      setHistory(first ? [first] : []);
      setHistIndex(0);
      applyView(undefined);
      setPhase("drill");
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) setPhase("done"); // hammasi o'zlashtirilgan
      else toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // To'g'ri javobdan keyin qisqa pauza (yashil + streak animatsiyasi ko'rinsin) → keyingi savol.
  // Taymer navRef orqali eng oxirgi goForward'ni chaqiradi (feedback/pool yangilangach).
  const scheduleNext = (ms: number) => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => navRef.current.forward(), ms);
  };

  // 1-urinish serverda tekshiriladi (streak shunga qarab o'zgaradi). Xato bo'lsa —
  // savoldan o'tilmaydi: to'g'risi topilmaguncha qayta uriniladi (lokal taqqoslash,
  // streak'ka ta'sir qilmaydi). To'g'risi bosilgach avtomatik keyingi savol.
  const onOption = async (oid: string) => {
    if (answering || solvedQ || !current) return;
    if (feedback) {
      if (oid === feedback.correctOptionId) {
        setSelected(oid);
        setSolvedQ(true);
        scheduleNext(900);
      } else if (!wrongPicks.includes(oid)) {
        setWrongPicks((w) => [...w, oid]);
      }
      return;
    }
    setSelected(oid);
    setAnswering(true);
    try {
      const res = await smartTestApi.answer(current.questionId, oid);
      setFeedback(res);
      setStreaks((m) => ({ ...m, [current.questionId]: res.streak }));
      if (res.mastered) {
        setMasteredCount((c) => c + 1);
        // O'zlashtirilgan savol shu sessiyada qayta tushmaydi (pool'dan olib tashlanadi)
        // va navigatsiyada o'tkazib yuboriladi (tarixda qolsa ham qayta so'ralmaydi).
        masteredIdsRef.current.add(current.questionId);
        setPool((p) => p.filter((q) => q.questionId !== current.questionId));
      }
      if (res.isCorrect) {
        setSolvedQ(true);
        scheduleNext(res.mastered ? 1500 : 1000);
      } else {
        setWrongPicks([oid]);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
      setSelected(null);
    } finally {
      setAnswering(false);
    }
  };

  // Tarix oxirida yangi tasodifiy savolni qo'shadi (pool bo'sh bo'lsa — yangi batch).
  const appendNew = async () => {
    const nextQ = pickRandom(pool, current?.questionId ?? null);
    if (nextQ) {
      setHistory((h) => [...h, nextQ]);
      setHistIndex((i) => i + 1);
      applyView(undefined);
      return;
    }
    try {
      const s = await smartTestApi.start();
      if (!s.questions.length) {
        setPhase("done");
        return;
      }
      seedStreaks(s.questions);
      setPool(s.questions);
      setStreakTarget(s.streakTarget);
      const q = pickRandom(s.questions, null);
      if (q) {
        setHistory((h) => [...h, q]);
        setHistIndex((i) => i + 1);
        applyView(undefined);
      }
    } catch {
      setPhase("done"); // 409 = hammasi o'zlashtirilgan
    }
  };

  const saveCurrentView = () => {
    if (current) setViews((m) => ({ ...m, [histIndex]: snapshot() }));
  };

  // Oldinga (F7 / tugma): tarixda keyingi (o'zlashtirilmagan) pozitsiyaga o'tadi;
  // yo'q bo'lsa — yangi tasodifiy savol qo'shadi.
  const goForward = () => {
    if (answering || !current) return;
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    saveCurrentView();
    let target = histIndex + 1;
    while (
      target < history.length &&
      masteredIdsRef.current.has(history[target].questionId)
    ) {
      target += 1; // o'zlashtirilgan savolni o'tkazib yuboramiz
    }
    if (target < history.length) {
      applyView(views[target]);
      setHistIndex(target);
      return;
    }
    void appendNew();
  };

  // Orqaga (F6 / tugma): avval ko'rilgan (o'zlashtirilmagan) savolga qaytadi.
  const goBack = () => {
    if (answering) return;
    let target = histIndex - 1;
    while (target >= 0 && masteredIdsRef.current.has(history[target].questionId)) {
      target -= 1;
    }
    if (target < 0) return; // orqada boshqa savol yo'q
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    saveCurrentView();
    applyView(views[target]);
    setHistIndex(target);
  };

  // Klaviatura handleri doim eng so'nggi funksiyalarni chaqirsin
  navRef.current = { back: goBack, forward: goForward };

  const exit = () => navigate("/exam");

  // ---------------- ENTRY ----------------
  if (phase === "entry") {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden p-4 lg:p-6">
        <GradientBg />
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10"
        >
          <BackButton label={tt.back} onClick={exit} />
        </motion.div>

        <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-5 py-6">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-glow"
          >
            <Brain className="h-7 w-7" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-extrabold text-ink">{tt.name}</h1>
            <p className="text-sm text-muted">{tt.desc}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="rounded-3xl border border-amber-400/25 bg-amber-400/10 p-4">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <div className="mt-2 text-3xl font-extrabold tabular-nums text-ink">
              {info?.unknown ?? 0}
            </div>
            <div className="text-xs font-medium text-muted">{tt.unknownLabel}</div>
          </div>
          <div className="rounded-3xl border border-success/25 bg-success/10 p-4">
            <Trophy className="h-5 w-5 text-success" />
            <div className="mt-2 text-3xl font-extrabold tabular-nums text-ink">
              {info?.known ?? 0}
            </div>
            <div className="text-xs font-medium capitalize text-muted">{tt.masteredLabel}</div>
          </div>
        </motion.div>

        {info?.advise && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
            className="flex items-center gap-3 rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/15 to-accent-dark/10 p-4"
          >
            <Sparkles className="h-6 w-6 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-ink">{tt.adviceTitle}</div>
              <p className="text-xs text-muted">{tt.adviceText}</p>
            </div>
            <button onClick={() => navigate("/real-exam")} className="btn-primary shrink-0 text-sm">
              <Radio className="h-4 w-4" />
              {tt.adviceBtn}
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 text-center"
        >
          <div className="mx-auto flex items-center justify-center gap-1.5">
            {Array.from({ length: info?.streak ?? 5 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15 + i * 0.06, type: "spring", stiffness: 400 }}
                className="h-3 w-3 rounded-full bg-violet-500"
              />
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-sm text-sm text-muted">{tt.note(info?.streak ?? 5)}</p>
          <button
            onClick={start}
            disabled={loading}
            className="btn-primary mt-5 w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-base shadow-glow"
          >
            {loading ? (
              tt.loading
            ) : (
              <>
                <Brain className="h-5 w-5" />
                {tt.start}
              </>
            )}
          </button>
        </motion.div>
        </div>
      </div>
    );
  }

  // ---------------- DONE (hammasi o'zlashtirilgan) ----------------
  if (phase === "done") {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
        <GradientBg />
        <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-glow"
        >
          <Trophy className="h-12 w-12" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-5 text-3xl font-extrabold text-ink"
        >
          {tt.allDoneTitle}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="mt-2 text-muted"
        >
          {tt.allDoneDesc}
        </motion.p>
        <div className="mt-6 flex w-full gap-2">
          <button onClick={() => setPhase("entry")} className="btn-ghost flex-1 py-3">
            <RotateCcw className="h-4 w-4" />
            {tt.again}
          </button>
          <button onClick={() => navigate("/dashboard")} className="btn-primary flex-1 py-3">
            {tt.home}
          </button>
        </div>
        </div>
      </div>
    );
  }

  // ---------------- DRILL ----------------
  if (!current) return <PageLoader />;
  const imgSrc = current.imageUrl ? assetUrl(current.imageUrl) : NO_IMAGE_SRC;
  const curStreak = feedback ? feedback.streak : streaks[current.questionId] ?? current.streak ?? 0;
  const expl = feedback?.explanation ? pickText(feedback.explanation, contentLang) : "";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl select-none flex-col gap-4 p-4 lg:p-6">
      {/* Header — vaqt YO'Q, faqat o'zlashtirilgan soni + asosiy bo'lim tugmasi */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <BackButton label={tt.back} onClick={exit} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3.5 py-2 text-sm font-bold text-success">
            <Trophy className="h-4 w-4" />
            {masteredCount} {tt.sessionMastered}
          </div>
          <ContentLangSwitcher value={contentLang} onChange={setContentLang} compact />
        </div>
      </header>

      {/* KETMA-KETLIK — asosiy ko'rsatkich */}
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3">
        <Flame className={cn("h-5 w-5", curStreak > 0 ? "text-fuchsia-500" : "text-muted")} />
        <span className="text-sm font-medium text-muted">{tt.streakLabel}:</span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: streakTarget }).map((_, i) => (
            <motion.span
              key={i}
              animate={{
                scale: i === curStreak - 1 ? [1, 1.4, 1] : 1,
              }}
              transition={{ duration: 0.35 }}
              className={cn(
                "h-3.5 w-3.5 rounded-full transition-colors",
                i < curStreak ? "bg-gradient-to-br from-violet-500 to-fuchsia-600" : "bg-line/25"
              )}
            />
          ))}
        </div>
        <span className="text-sm font-extrabold tabular-nums text-fuchsia-500">
          {curStreak}/{streakTarget}
        </span>
      </div>

      {/* Savol — har yangisi animatsiya bilan kiradi (AnimatePresence'siz) */}
      <motion.div
        key={current.questionId}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4"
      >
        <div className="rounded-2xl bg-[#1E429F] px-5 py-5 text-center shadow-glow">
          <h2 className="mx-auto max-w-2xl text-lg font-bold leading-snug text-white lg:text-xl">
            {pickText(current.text, contentLang)}
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div
            className={cn(
              "overflow-hidden rounded-xl border border-line/10 p-2",
              current.imageUrl ? "bg-white" : "bg-[#0a0f1a]"
            )}
          >
            <ZoomableImage src={imgSrc} imgClassName="mx-auto max-h-[320px] w-full object-contain" />
          </div>

          <div className="flex flex-col gap-2.5">
            {current.options.map((o, i) => {
              // Yashil — faqat to'g'ri javob BOSILGANDA; xato urinishlar qizil qoladi
              const correct = solvedQ && !!feedback && o.optionId === feedback.correctOptionId;
              const wrong = wrongPicks.includes(o.optionId);
              return (
                <motion.button
                  key={o.optionId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onOption(o.optionId)}
                  disabled={solvedQ || wrong || answering}
                  className={cn(
                    "rounded-xl border px-4 py-3.5 text-left font-medium transition-all",
                    !solvedQ && !wrong &&
                      "border-line/15 bg-card/60 text-ink hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-glow",
                    correct && "border-green-600 bg-green-600/90 text-white",
                    wrong && "border-red-600 bg-red-600/90 text-white",
                    solvedQ && !correct && !wrong && "border-line/10 bg-card/30 text-muted opacity-60"
                  )}
                >
                  {pickText(o.text, contentLang)}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Fikr-mulohaza */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-2xl border p-4",
            feedback.mastered
              ? "border-violet-500/40 bg-violet-500/10"
              : feedback.isCorrect
              ? "border-success/30 bg-success/10"
              : "border-danger/30 bg-danger/10"
          )}
        >
          <div className="flex items-center gap-2 font-bold">
            {feedback.isCorrect ? (
              <Check className="h-5 w-5 text-success" />
            ) : (
              <X className="h-5 w-5 text-danger" />
            )}
            <span className={feedback.isCorrect ? "text-success" : "text-danger"}>
              {feedback.mastered ? tt.mastered : feedback.isCorrect ? tt.correct : tt.wrong}
            </span>
          </div>

          {feedback.mastered && (
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-1 text-sm font-medium text-violet-500"
            >
              {tt.masteredDesc}
            </motion.p>
          )}

          {expl && (
            <div className="mt-3 rounded-xl bg-bg2/50 p-3 text-sm text-ink/90">
              <span className="font-semibold text-accent">{tt.explanationLabel}: </span>
              {expl}
            </div>
          )}
        </motion.div>
      )}

      {/* Navigatsiya — orqaga (F6) / oldinga (F7); tugmalar ham ishlaydi */}
      <div className="mt-auto flex items-center gap-3 pt-1">
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={goBack}
          disabled={histIndex <= 0}
          className="btn-ghost"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{tt.prev}</span>
        </motion.button>
        <div className="flex-1" />
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={goForward}
          className="btn-primary shadow-glow"
        >
          <span className="hidden sm:inline">{tt.next}</span>
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}
