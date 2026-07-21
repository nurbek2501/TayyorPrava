import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Flag,
  Heart,
  LayoutGrid,
  Lightbulb,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { assetUrl, meApi, questionsApi, ticketsApi, topicsApi } from "@/lib/api";
import { pickText } from "@/lib/lang";
import { cn, formatClock } from "@/lib/utils";
import { useUiStore } from "@/store/ui";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { Logo } from "@/components/shared/Logo";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { ConfirmModal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/Spinner";
import { ZoomableImage } from "@/components/ui/ZoomableImage";
import { toast } from "@/components/ui/toast";
import type { LocalizedText, Question, UiLang } from "@/lib/types";

// Mashq natijasi — to'g'ri javob faqat /check-answer'dan keyin ma'lum bo'ladi
type AnswerResult = {
  selectedId: string;
  correctId: string | null;
  isCorrect: boolean;
  explanation: LocalizedText | null;
};

const FINISH_T: Record<UiLang, { finish: string; title: string; yes: string; no: string }> = {
  uz: { finish: "Yakunlash", title: "Testni yakunlaysizmi?", yes: "Ha, yakunlash", no: "Yo'q" },
  kr: { finish: "Якунлаш", title: "Тестни якунлайсизми?", yes: "Ҳа, якунлаш", no: "Йўқ" },
  ru: { finish: "Завершить", title: "Завершить тест?", yes: "Да, завершить", no: "Нет" },
};

// Oraliq nazorat taymeri — alohida komponent (har soniyalik tick faqat shuni
// yangilaydi, butun sahifa qayta render bo'lmaydi).
function OraliqTimer({ seconds, onTimeUp }: { seconds: number; onTimeUp: () => void }) {
  const [left, setLeft] = useState(seconds);
  const firedRef = useRef(false);
  useEffect(() => {
    if (left <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onTimeUp();
      }
      return;
    }
    const tm = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(tm);
  }, [left, onTimeUp]);
  const low = left <= 60;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-base font-bold",
        low ? "bg-danger/15 text-danger animate-pulse-danger" : "bg-bg2/70 text-ink"
      )}
    >
      <Clock className="h-4 w-4" />
      {formatClock(left)}
    </div>
  );
}

export function LessonTestPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const contentLang = useUiStore((s) => s.contentLang);
  const uiLang = useUiStore((s) => s.uiLang);

  const topicsQ = useQuery({ queryKey: ["topics"], queryFn: topicsApi.list });

  const questionsQ = useQuery({
    queryKey: ["lessonQuestions", id],
    enabled: id !== "random" || !!topicsQ.data,
    queryFn: async (): Promise<Question[]> => {
      if (id === "favorites") return meApi.favorites();
      if (id === "mistakes") return meApi.mistakes();
      if (id?.startsWith("bilet-")) return ticketsApi.questions(Number(id.slice(6)));
      if (id?.startsWith("oraliq-")) return questionsApi.random(Number(id.slice(7)));
      if (id === "random") {
        const topics = topicsQ.data ?? (await topicsApi.list());
        const withQ = topics.filter((x) => x.questionCount > 0);
        if (!withQ.length) return [];
        const pick = withQ[Math.floor(Math.random() * withQ.length)];
        return questionsApi.byTopic(pick.id);
      }
      return questionsApi.byTopic(Number(id));
    },
  });

  const questions = questionsQ.data ?? [];
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, AnswerResult>>({});
  // Xato urinishlar (qizil bo'lib qoladi) va yechilgan savollar (to'g'risi bosilgan)
  const [wrongPicks, setWrongPicks] = useState<Record<string, string[]>>({});
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showExpl, setShowExpl] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);

  // Avto-o'tish taymeri — foydalanuvchi yashil javobni ko'rgach keyingi savol
  const advanceTimer = useRef<number | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    []
  );

  useEffect(() => setShowExpl(false), [index]);

  const current = questions[index];
  const total = questions.length;
  const answeredCount = Object.keys(results).length;
  const progress = total ? Math.round((answeredCount / total) * 100) : 0;
  const isOraliq = Boolean(id?.startsWith("oraliq-"));
  const ft = FINISH_T[uiLang] ?? FINISH_T.uz;

  // Klaviatura: F6 — oldingi savol, F7 — keyingi savol (oxirgisida yakunlash tasdig'i,
  // xuddi «Keyingi» tugmasini bosgandek). Pastdagi tugmalar ham ishlayveradi.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F6" && e.key !== "F7") return;
      e.preventDefault();
      if (finishConfirmOpen || !total) return;
      if (e.key === "F6") {
        setIndex((i) => Math.max(0, i - 1));
      } else if (indexRef.current >= total - 1) {
        setFinishConfirmOpen(true);
      } else {
        setIndex((i) => Math.min(total - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, finishConfirmOpen]);

  if (questionsQ.isLoading) return <PageLoader />;

  if (!questions.length) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted">{t("common.empty")}</p>
        <button onClick={() => navigate(-1)} className="btn-primary">
          {t("common.back")}
        </button>
      </div>
    );
  }

  const result = current ? results[current.id] : undefined;
  const isSolved = current ? Boolean(solved[current.id]) : false;
  const wrongs = current ? (wrongPicks[current.id] ?? []) : [];
  const answered = Boolean(result);

  // To'g'ri javob bosilgach — qisqa pauza (yashil ko'rinsin), keyin avtomatik keyingi savol.
  // Oxirgi savolda yakunlash tasdig'i ochiladi.
  const goNextAuto = (fromIndex: number) => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      if (indexRef.current !== fromIndex) return; // foydalanuvchi o'zi boshqa savolga o'tgan
      if (fromIndex >= total - 1) setFinishConfirmOpen(true);
      else setIndex(fromIndex + 1);
    }, 900);
  };

  const markSolved = (qid: string) => {
    setSolved((s) => ({ ...s, [qid]: true }));
    goNextAuto(index);
  };

  // Variant tanlanganda SERVER tomonida tekshiriladi — to'g'ri javob shu yerda keladi.
  // Xato bo'lsa backend uni avtomatik "xatolar" ro'yxatiga qo'shadi.
  // To'g'ri javob topilmaguncha savoldan o'tilmaydi: xato variantlar qizil bo'lib
  // qolaveradi, foydalanuvchi qayta urinadi (keyingi urinishlar lokal taqqoslanadi).
  const answer = async (optionId: string) => {
    if (!current || solved[current.id] || checkingId === current.id) return;
    const qid = current.id;
    const prev = results[qid];
    if (prev) {
      // 1-urinish xato bo'lgan — to'g'ri javob ID'si allaqachon ma'lum, lokal solishtiramiz
      if (optionId === prev.correctId) markSolved(qid);
      else if (!wrongs.includes(optionId))
        setWrongPicks((w) => ({ ...w, [qid]: [...(w[qid] ?? []), optionId] }));
      return;
    }
    setCheckingId(qid);
    try {
      const res = await questionsApi.checkAnswer(qid, optionId);
      setResults((r) => ({
        ...r,
        [qid]: {
          selectedId: optionId,
          correctId: res.correctOptionId,
          isCorrect: res.isCorrect,
          explanation: res.explanation,
        },
      }));
      if (res.isCorrect) markSolved(qid);
      else setWrongPicks((w) => ({ ...w, [qid]: [...(w[qid] ?? []), optionId] }));
    } catch {
      toast.error("Tekshirishda xatolik");
    } finally {
      setCheckingId(null);
    }
  };

  const toggleFav = async () => {
    if (!current) return;
    try {
      const res = await meApi.toggleFavorite(current.id);
      setFavorites((f) => ({ ...f, [current.id]: res.favorite }));
      // Sevimlilar serverda o'zgardi — keshni yangilaymiz, aks holda bosh sahifadagi
      // «Sevimlilar» hisobi va /lesson/favorites ro'yxati eski holatda qoladi.
      qc.invalidateQueries({ queryKey: ["meStats"] });
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["lessonQuestions", "favorites"] });
      toast.success(res.favorite ? "Sevimlilarga qo'shildi" : "Sevimlilardan olib tashlandi");
    } catch {
      toast.error("Xatolik");
    }
  };


  const hasImage = Boolean(current?.imageUrl);

  const questionText = (
    <motion.h2
      key={`${current?.id}-${contentLang}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="text-xl font-bold leading-snug text-ink lg:text-2xl"
    >
      {pickText(current?.text, contentLang)}
    </motion.h2>
  );

  const optionsBlock = (
    <div className={cn("space-y-3", hasImage ? "mt-5" : "mt-6")}>
      {current?.options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        // Yashil — faqat to'g'ri javob BOSILGANDA; xato urinishlar qizil bo'lib qoladi
        const correct = isSolved && result?.correctId === opt.id;
        const wrong = wrongs.includes(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => answer(opt.id)}
            disabled={isSolved || wrong || checkingId === current?.id}
            className={cn(
              "group flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all",
              !isSolved && !wrong &&
                "border-line/15 bg-card/50 hover:-translate-y-0.5 hover:border-accent/60 hover:bg-card hover:shadow-glow",
              correct && "border-success/60 bg-success/10",
              wrong && "border-danger/60 bg-danger/10",
              isSolved && !correct && !wrong && "border-line/10 bg-card/30 opacity-60"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                correct
                  ? "bg-success text-white"
                  : wrong
                    ? "bg-danger text-white"
                    : "bg-bg2 text-muted group-hover:bg-accent/20 group-hover:text-accent"
              )}
            >
              {letter}
            </span>
            <span className="flex-1 font-medium text-ink">{pickText(opt.text, contentLang)}</span>
            {correct && <Check className="h-5 w-5 shrink-0 text-success" />}
            {wrong && <X className="h-5 w-5 shrink-0 text-danger" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 lg:p-6">
      {/* Toolbar — barcha amallar bitta qatorda; til almashtirish endi bitta
          umumiy LangSwitcher orqali (interfeys + savol tili birga) */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Logo />
          {isOraliq && (
            <OraliqTimer
              seconds={total * 75}
              onTimeUp={() => {
                toast.warning("Vaqt tugadi!");
                navigate("/dashboard");
              }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LangSwitcher />
          <ThemeSwitcher />
          <button
            onClick={() => navigate("/lesson")}
            title={t("admin.topics")}
            className="btn-ghost h-10 w-10 rounded-full p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setFinishConfirmOpen(true)} className="btn-primary">
            <Flag className="h-4 w-4" />
            {ft.finish}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="btn-ghost h-10 w-10 rounded-full p-0 text-danger"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Question navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {questions.map((q, i) => {
          const r = results[q.id];
          return (
            <button
              key={q.id}
              onClick={() => setIndex(i)}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold transition",
                i === index
                  ? "border-2 border-accent bg-accent/10 text-ink"
                  : r
                    ? r.isCorrect
                      ? "border-transparent bg-success/15 text-success"
                      : "border-transparent bg-danger/15 text-danger"
                    : "border-transparent bg-card/50 text-muted hover:text-ink"
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Question block */}
      <div className="glass-card flex-1 p-5 lg:p-6">
        <div className="flex items-center justify-between">
          <span className="chip bg-accent/15 text-accent">
            {index + 1} / {total} {t("lesson.question").toLowerCase()}
          </span>
          <button onClick={toggleFav} className="btn-ghost h-9 w-9 rounded-full p-0">
            <Heart
              className={cn("h-5 w-5", favorites[current!.id] && "fill-danger text-danger")}
            />
          </button>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            {questionText}
            {optionsBlock}
          </div>
          {/* Rasm bor bo'lsa savol rasmi, bo'lmasa TayyorPrava placeholder (cho'zilmaydi) */}
          <div
            className={cn(
              "flex items-start justify-center rounded-2xl p-3",
              hasImage ? "bg-white" : "bg-[#0a0f1a]"
            )}
          >
            <ZoomableImage
              src={hasImage ? assetUrl(current!.imageUrl) : "/no-image-car.webp"}
              imgClassName="max-h-[380px] w-full rounded-xl object-contain"
            />
          </div>
        </div>

        {answered && result?.explanation && (
          <div className="mt-5">
            <button onClick={() => setShowExpl((s) => !s)} className="btn-ghost">
              <Lightbulb className="h-4 w-4 text-warning" />
              {t("lesson.showExplanation")}
            </button>
            <AnimatePresence>
              {showExpl && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden rounded-xl bg-bg2/60 p-4 text-sm text-muted"
                >
                  {pickText(result.explanation, contentLang)}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 lg:gap-4">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="btn-ghost"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{t("common.prev")}</span>
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-dark transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {index === total - 1 ? (
          <button
            onClick={() => setFinishConfirmOpen(true)}
            className="btn-primary shadow-glow"
          >
            <Flag className="h-4 w-4" />
            {ft.finish}
          </button>
        ) : (
          <button
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="btn-primary shadow-glow"
          >
            <span className="hidden sm:inline">{t("common.next")}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Yakunlash tasdig'i — real imtihondan tashqari barcha test bo'limlarida */}
      <ConfirmModal
        open={finishConfirmOpen}
        title={ft.title}
        confirmText={ft.yes}
        cancelText={ft.no}
        onConfirm={() => {
          setFinishConfirmOpen(false);
          navigate("/dashboard");
        }}
        onCancel={() => setFinishConfirmOpen(false)}
      />
    </div>
  );
}
