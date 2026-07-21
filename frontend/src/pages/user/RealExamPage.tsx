import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Flag,
  Gift,
  GraduationCap,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Lock,
  Monitor,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserPlus,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { assetUrl, getErrorMessage, realExamApi } from "@/lib/api";
import { pickText } from "@/lib/lang";
import { isApp } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { useRealExam } from "@/store/realExam";
import { useUiStore } from "@/store/ui";
import { BackButton } from "@/components/shared/BackButton";
import { Logo } from "@/components/shared/Logo";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/Spinner";
import { ZoomableImage } from "@/components/ui/ZoomableImage";
import { toast } from "@/components/ui/toast";
import type { ContentLang, UiLang } from "@/lib/types";

// Rasmi yo'q savollar uchun standart rasm (TayyorPrava mashinasi).
const NO_IMAGE_SRC = "/no-image-car.webp";

/** Referensdagi taymer formati: `0:20:20` (soat:daqiqa:soniya). */
function formatExamClock(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Imtihon til tablari — referensdagi 3 til (savol bazasi 3 tilli: uz/kirill/rus). */
const EXAM_LANGS: { code: ContentLang; label: string }[] = [
  { code: "uz", label: "O'zbek tili" },
  { code: "kaa", label: "Ўзбек тили" },
  { code: "ru", label: "Русский язык" },
];

// Imtihon turi: «first» — birinchi marta topshirayotganlar (20 savol);
// «restore» — guvohnomadan mahrum bo'lganlar (50 savol). Vaqt savol soniga
// qarab belgilanadi (har savolga 1.25 daqiqa = 75 soniya).
type ExamMode = "first" | "restore";
interface ModeCfg {
  count: number;
  minutes: number;
  maxMistakes: number;
}
const MODE_CFG: Record<ExamMode, ModeCfg> = {
  first: { count: 20, minutes: 25, maxMistakes: 2 },
  restore: { count: 50, minutes: 63, maxMistakes: 4 },
};

// Imtihon turini tanlash ekrani matnlari — interfeys tilida (uiLang).
// Tariflar sodda: katta-yu kichik, har qanday odam tushunadi.
const MODE_T: Record<
  UiLang,
  {
    heading: string;
    sub: string;
    questionsLabel: string;
    minutesLabel: string;
    mistakesLabel: string;
    pick: string;
    first: { title: string; desc: string; badge: string };
    restore: { title: string; desc: string; badge: string };
  }
> = {
  uz: {
    heading: "Imtihon turini tanlang",
    sub: "O'zingizga mos turdagi imtihonni tanlang — keyin imtihon boshlanadi.",
    questionsLabel: "savol",
    minutesLabel: "daqiqa",
    mistakesLabel: "xatogacha",
    pick: "Tanlash",
    first: {
      title: "Birinchi marta topshiruvchilar",
      desc: "Haydovchilik guvohnomasini birinchi marta olayotganlar uchun. 20 ta savol beriladi.",
      badge: "Yangi nomzodlar",
    },
    restore: {
      title: "Guvohnomadan mahrum bo'lganlar",
      desc: "Guvohnomasi qaytarib olingan (mahrum etilgan) haydovchilar uchun. 50 ta savol beriladi.",
      badge: "Qayta tiklash",
    },
  },
  kr: {
    heading: "Имтиҳон турини танланг",
    sub: "Ўзингизга мос турдаги имтиҳонни танланг — кейин имтиҳон бошланади.",
    questionsLabel: "савол",
    minutesLabel: "дақиқа",
    mistakesLabel: "хатогача",
    pick: "Танлаш",
    first: {
      title: "Биринчи марта топширувчилар",
      desc: "Ҳайдовчилик гувоҳномасини биринчи марта олаётганлар учун. 20 та савол берилади.",
      badge: "Янги номзодлар",
    },
    restore: {
      title: "Гувоҳномадан маҳрум бўлганлар",
      desc: "Гувоҳномаси қайтариб олинган (маҳрум этилган) ҳайдовчилар учун. 50 та савол берилади.",
      badge: "Қайта тиклаш",
    },
  },
  ru: {
    heading: "Выберите тип экзамена",
    sub: "Выберите подходящий тип экзамена — затем начнётся экзамен.",
    questionsLabel: "вопросов",
    minutesLabel: "минут",
    mistakesLabel: "ошибок макс.",
    pick: "Выбрать",
    first: {
      title: "Сдающие впервые",
      desc: "Для тех, кто получает водительское удостоверение впервые. Даётся 20 вопросов.",
      badge: "Новые кандидаты",
    },
    restore: {
      title: "Лишённые прав",
      desc: "Для водителей, восстанавливающих удостоверение после лишения. Даётся 50 вопросов.",
      badge: "Восстановление",
    },
  },
};

// Savol tiliga (contentLang) mos matnlar — barcha modallar shu tilda chiqadi.
const EXAM_TXT: Record<
  ContentLang,
  {
    question: string;
    confirmWith: (v: string) => string;
    yes: string;
    no: string;
    finish: string;
    finishConfirm: string;
    exitConfirm: string;
    guardTitle: string;
    guardText: string;
  }
> = {
  uz: {
    question: "savol",
    confirmWith: (v) => `Siz «${v}» javobini haqiqatan tasdiqlaysizmi?`,
    yes: "Ha",
    no: "Yo'q",
    finish: "Yakunlash",
    finishConfirm: "Imtihonni haqiqatan yakunlaysizmi?",
    exitConfirm: "Chiqsangiz imtihon yakunlanadi va natija saqlanmaydi. Chiqasizmi?",
    guardTitle: "Diqqat!",
    guardText:
      "Imtihon vaqtida boshqa oyna, ilova yoki skrinshotga ruxsat berilmaydi. Imtihonga qayting.",
  },
  kaa: {
    question: "савол",
    confirmWith: (v) => `Сиз «${v}» жавобини ҳақиқатан тасдиқлайсизми?`,
    yes: "Ҳа",
    no: "Йўқ",
    finish: "Якунлаш",
    finishConfirm: "Имтиҳонни ҳақиқатан якунлайсизми?",
    exitConfirm: "Чиқсангиз имтиҳон якунланади ва натижа сақланмайди. Чиқасизми?",
    guardTitle: "Диққат!",
    guardText:
      "Имтиҳон вақтида бошқа ойна, илова ёки скриншотга рухсат берилмайди. Имтиҳонга қайтинг.",
  },
  ru: {
    question: "вопрос",
    confirmWith: (v) => `Вы действительно подтверждаете ответ «${v}»?`,
    yes: "Да",
    no: "Нет",
    finish: "Завершить",
    finishConfirm: "Вы действительно хотите завершить экзамен?",
    exitConfirm: "Если выйдете, экзамен завершится и результат не сохранится. Выйти?",
    guardTitle: "Внимание!",
    guardText:
      "Во время экзамена нельзя переключаться на другое окно, приложение или делать скриншот. Вернитесь к экзамену.",
  },
};

// Timer alohida komponent — har soniyalik tick faqat shuni yangilaydi.
function ExamTimer({ onTimeUp }: { onTimeUp: () => void }) {
  const timeLeftSec = useRealExam((s) => s.timeLeftSec);
  const status = useRealExam((s) => s.status);
  const tick = useRealExam((s) => s.tick);
  const firedRef = useRef(false);

  useEffect(() => {
    if (status !== "in_progress") return;
    const id = setInterval(() => tick(), 1000);
    // Tab/app fonga tushib qaytganda darhol qayta hisoblash (wall-clock — kutmaydi).
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status, tick]);

  useEffect(() => {
    if (status === "in_progress" && timeLeftSec === 0 && !firedRef.current) {
      firedRef.current = true;
      onTimeUp();
    }
  }, [timeLeftSec, status, onTimeUp]);

  const lowTime = timeLeftSec <= 60;
  // Referensdagi kabi: rasm ustida, o'ng-yuqorida turadigan qora raqamli badge.
  return (
    <div
      className={cn(
        "exam-timer exam-display px-2 py-[2px] text-[15px] font-semibold tabular-nums leading-none lg:text-[17px]",
        lowTime ? "animate-pulse-danger text-red-300" : "text-white"
      )}
    >
      {formatExamClock(timeLeftSec)}
    </div>
  );
}

/** Terminal foni — nuqtali halftone + ko'k/siyoh yorug'lik yoylari + don. */
function ExamBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="exam-ring exam-ring-blue -left-[38%] -top-[72%] h-[165vh] w-[165vh]" />
      <div className="exam-ring exam-ring-violet -bottom-[78%] -right-[38%] h-[170vh] w-[170vh]" />
      <div className="exam-dots exam-dots-l" />
      <div className="exam-dots exam-dots-r" />
      <div className="exam-grain" />
    </div>
  );
}

function StatBox({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Clock;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-line/10 bg-bg2/50 p-3">
      <Icon className="mx-auto h-5 w-5 text-accent" />
      <div className="mt-1.5 text-xl font-extrabold text-ink">{value}</div>
      <div className="text-[11px] leading-tight text-muted">{label}</div>
    </div>
  );
}

// Ilovada (PWA) real imtihonga kirilganda chiqadigan maslahat — 3 tilda.
const APP_HINT: Record<UiLang, { title: string; text: string; ok: string }> = {
  uz: {
    title: "Maslahat",
    text: "Siz kompyuterda bajarsangiz, haqiqiy imtihon muhitini his qilasiz.",
    ok: "Tushunarli",
  },
  kr: {
    title: "Маслаҳат",
    text: "Сиз компютерда бажарсангиз, ҳақиқий имтиҳон муҳитини ҳис қиласиз.",
    ok: "Тушунарли",
  },
  ru: {
    title: "Совет",
    text: "Если выполните на компьютере, почувствуете настоящую атмосферу экзамена.",
    ok: "Понятно",
  },
};

// Imtihon turini tanlash ekrani — ikkita chiroyli, animatsion karta.
// Bu ekran imtihon UI'siga umuman tegmaydi; faqat imtihondan oldin chiqadi.
function ModeSelectScreen({
  uiLang,
  onPick,
  onBack,
}: {
  uiLang: UiLang;
  onPick: (m: ExamMode) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const tt = MODE_T[uiLang] ?? MODE_T.uz;
  // Ilovada kirilganda — kompyuter haqida animatsiyali maslahat.
  const [appHint, setAppHint] = useState(isApp());
  const hint = APP_HINT[uiLang] ?? APP_HINT.uz;
  const cards: {
    mode: ExamMode;
    icon: typeof Clock;
    accent: string;
    txt: { title: string; desc: string; badge: string };
  }[] = [
    { mode: "first", icon: UserPlus, accent: "from-accent to-blue-900", txt: tt.first },
    {
      mode: "restore",
      icon: RotateCcw,
      accent: "from-amber-500 to-orange-700",
      txt: tt.restore,
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-4 h-72 w-72 rounded-full bg-blue-900/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-accent-dark/20 blur-3xl" />

      <div className="absolute left-4 top-4 z-20">
        <BackButton label={t("common.back")} onClick={onBack} />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        <div className="animate-fade-up mb-7 text-center">
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <h1 className="bg-gradient-to-r from-ink to-accent bg-clip-text text-2xl font-extrabold text-transparent lg:text-3xl">
            {tt.heading}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">{tt.sub}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c, i) => {
            const Icon = c.icon;
            const cfg = MODE_CFG[c.mode];
            return (
              <button
                key={c.mode}
                onClick={() => onPick(c.mode)}
                style={{ animationDelay: `${0.08 + i * 0.12}s` }}
                className="animate-fade-up group relative flex flex-col overflow-hidden rounded-3xl border border-line/15 bg-card/80 p-6 text-left shadow-glass backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/60 hover:shadow-glow"
              >
                <span className="absolute right-4 top-4 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold text-accent">
                  {c.txt.badge}
                </span>
                <div
                  className={cn(
                    "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-glow transition-transform duration-300 group-hover:scale-110",
                    c.accent
                  )}
                >
                  <Icon className="h-8 w-8" />
                </div>
                <h2 className="text-lg font-extrabold leading-tight text-ink">{c.txt.title}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{c.txt.desc}</p>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-bg2/60 p-2.5 text-center">
                    <div className="text-xl font-extrabold text-ink">{cfg.count}</div>
                    <div className="text-[10px] leading-tight text-muted">{tt.questionsLabel}</div>
                  </div>
                  <div className="rounded-xl bg-bg2/60 p-2.5 text-center">
                    <div className="text-xl font-extrabold text-ink">{cfg.minutes}</div>
                    <div className="text-[10px] leading-tight text-muted">{tt.minutesLabel}</div>
                  </div>
                  <div className="rounded-xl bg-bg2/60 p-2.5 text-center">
                    <div className="text-xl font-extrabold text-ink">{cfg.maxMistakes}</div>
                    <div className="text-[10px] leading-tight text-muted">{tt.mistakesLabel}</div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-sm font-bold text-accent">{tt.pick}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-transform duration-300 group-hover:translate-x-1">
                    <ChevronRight className="h-5 w-5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* Ilovada (PWA) — kompyuter haqida animatsiyali maslahat */}
      {appHint && (
        <div className="animate-fade-in fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="animate-zoom-in w-full max-w-sm rounded-3xl border border-line/15 bg-card p-7 text-center shadow-glass">
            <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent to-blue-900 shadow-glow ring-1 ring-white/10">
              <Monitor className="h-10 w-10 text-white" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-accent" />
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-ink">💻 {hint.title}</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
              {hint.text}
            </p>
            <button
              onClick={() => setAppHint(false)}
              className="btn-primary mt-6 w-full py-3 text-base shadow-glow"
            >
              {hint.ok}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Real imtihonga kirishdagi chiroyli boshlash modali (yumaloq, gradientli).
function StartScreen({
  cfg,
  onStart,
  onBack,
}: {
  cfg: ModeCfg;
  onStart: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<{
    price: number;
    hasAccess: boolean;
    bonus: number;
    locked: boolean;
  } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [method, setMethod] = useState("click");

  // Chegirma promokodi (ixtiyoriy) — admin yaratgan, real imtihon narxini kamaytiradi.
  const [promoInput, setPromoInput] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountPercent: number;
    discountedPrice: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<{
    message: string;
    alreadyUsed: boolean;
  } | null>(null);

  // Narx + bonus + to'langan (ishlatilmagan) kirish bor-yo'qligini olamiz
  useEffect(() => {
    realExamApi
      .info()
      .then(setInfo)
      .catch(() => setInfo({ price: 0, hasAccess: true, bonus: 0, locked: false }));
  }, []);

  const locked = !!info?.locked;
  const needPay = !!info && !locked && info.price > 0 && !info.hasAccess;
  const priceStr = (info?.price ?? 0).toLocaleString("ru-RU");

  const handleStartClick = () => {
    if (locked) return;
    if (needPay) setPayOpen(true);
    else onStart();
  };

  const handlePromoInputChange = (v: string) => {
    setPromoInput(v.toUpperCase());
    if (appliedPromo) setAppliedPromo(null);
    if (promoError) setPromoError(null);
  };

  const handleApplyPromo = async () => {
    const trimmed = promoInput.trim();
    if (!trimmed) return;
    setCheckingPromo(true);
    setPromoError(null);
    try {
      const res = await realExamApi.checkPromo(trimmed);
      if (res.valid) {
        setAppliedPromo({
          code: trimmed,
          discountPercent: res.discountPercent,
          discountedPrice: res.discountedPrice,
        });
      } else {
        setAppliedPromo(null);
        const alreadyUsed = res.reason === "already_used";
        setPromoError({
          message: alreadyUsed
            ? "Siz bu promokoddan allaqachon foydalangansiz"
            : "Promokod noto'g'ri yoki faol emas",
          alreadyUsed,
        });
      }
    } catch (e) {
      setAppliedPromo(null);
      setPromoError({ message: getErrorMessage(e), alreadyUsed: false });
    } finally {
      setCheckingPromo(false);
    }
  };

  const handlePay = async () => {
    setPurchasing(true);
    try {
      await realExamApi.purchase(method, appliedPromo?.code);
      setPayOpen(false);
      onStart(); // to'lovdan so'ng imtihon darhol boshlanadi
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPurchasing(false);
    }
  };

  // Bonus bilan sotib olish (balansdan yechiladi)
  const handleBonusPay = async () => {
    setPurchasing(true);
    try {
      await realExamApi.purchase("bonus", appliedPromo?.code);
      setPayOpen(false);
      onStart();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-4 h-72 w-72 rounded-full bg-blue-900/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-accent-dark/20 blur-3xl" />

      <div className="absolute left-4 top-4 z-20">
        <BackButton label={t("common.back")} onClick={onBack} />
      </div>

      <div className="animate-fade-up relative z-10 w-full max-w-md rounded-3xl bg-gradient-to-br from-accent/40 via-transparent to-accent-dark/30 p-px shadow-glass">
        <div className="rounded-3xl bg-card/80 p-8 text-center backdrop-blur-xl">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>

          <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-accent to-blue-900 shadow-glow ring-1 ring-white/10">
            <GraduationCap className="h-12 w-12 text-white" />
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-danger" />
            </span>
          </div>

          <h1 className="bg-gradient-to-r from-ink to-accent bg-clip-text text-2xl font-extrabold text-transparent">
            {t("realExam.startTitle")}
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{t("realExam.startDesc")}</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <StatBox
              icon={ListChecks}
              value={String(cfg.count)}
              label={t("realExam.startQuestions")}
            />
            <StatBox
              icon={Clock}
              value={String(cfg.minutes)}
              label={t("realExam.startMinutes")}
            />
            <StatBox
              icon={ShieldAlert}
              value={String(cfg.maxMistakes)}
              label={t("realExam.startMaxMistakes")}
            />
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/10 p-3 text-left">
            <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p className="text-xs leading-relaxed text-ink/90">{t("realExam.startFkeyTip")}</p>
          </div>

          {locked ? (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3">
              <Lock className="h-4 w-4 shrink-0 text-danger" />
              <span className="text-sm text-ink/90">
                Real imtihon bo'limi hozircha <b className="text-ink">yopiq</b>
              </span>
            </div>
          ) : (
            needPay && (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                <Wallet className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="text-sm text-ink/90">
                  Bir martalik kirish:{" "}
                  <b className="text-ink">{priceStr} so'm</b>
                </span>
              </div>
            )
          )}

          <button
            onClick={handleStartClick}
            disabled={!info || locked}
            className="btn-primary mt-6 w-full py-3 text-base shadow-glow disabled:opacity-60"
          >
            {!info ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Yuklanmoqda...
              </>
            ) : locked ? (
              <>
                <Lock className="h-5 w-5" />
                Vaqtincha yopiq
              </>
            ) : needPay ? (
              <>
                <CreditCard className="h-5 w-5" />
                To'lab boshlash · {priceStr} so'm
              </>
            ) : (
              <>
                <Radio className="h-5 w-5" />
                {t("realExam.startBtn")}
              </>
            )}
          </button>
          <p className="mt-3 text-xs text-muted">
            {locked ? "Administratsiya tomonidan vaqtincha to'xtatilgan." : t("realExam.startHint")}
          </p>
        </div>
      </div>

      <PaymentModal
        open={payOpen}
        price={info?.price ?? 0}
        bonus={info?.bonus ?? 0}
        method={method}
        onMethod={setMethod}
        purchasing={purchasing}
        onPay={handlePay}
        onBonusPay={handleBonusPay}
        onClose={() => {
          if (!purchasing) {
            setPayOpen(false);
            setPromoInput("");
            setAppliedPromo(null);
            setPromoError(null);
          }
        }}
        promoInput={promoInput}
        onPromoInputChange={handlePromoInputChange}
        onApplyPromo={handleApplyPromo}
        checkingPromo={checkingPromo}
        appliedPromo={appliedPromo}
        promoError={promoError}
      />
    </div>
  );
}

/** Real imtihon bir martalik to'lov modali — zamonaviy, darhol ochiladi. */
interface AppliedPromo {
  code: string;
  discountPercent: number;
  discountedPrice: number;
}

function PaymentModal({
  open,
  price,
  bonus,
  method,
  onMethod,
  purchasing,
  onPay,
  onBonusPay,
  onClose,
  promoInput,
  onPromoInputChange,
  onApplyPromo,
  checkingPromo,
  appliedPromo,
  promoError,
}: {
  open: boolean;
  price: number;
  bonus: number;
  method: string;
  onMethod: (m: string) => void;
  purchasing: boolean;
  onPay: () => void;
  onBonusPay: () => void;
  onClose: () => void;
  promoInput: string;
  onPromoInputChange: (v: string) => void;
  onApplyPromo: () => void;
  checkingPromo: boolean;
  appliedPromo: AppliedPromo | null;
  promoError: { message: string; alreadyUsed: boolean } | null;
}) {
  if (!open) return null;
  // Chegirma qo'llangan bo'lsa — YAKUNIY (chegirmali) narx to'lov/bonus tugmalarida ishlatiladi.
  const effectivePrice = appliedPromo ? appliedPromo.discountedPrice : price;
  const priceStr = effectivePrice.toLocaleString("ru-RU");
  const originalPriceStr = price.toLocaleString("ru-RU");
  const methods = [
    { code: "click", label: "Click" },
    { code: "payme", label: "Payme" },
    { code: "card", label: "Bank karta" },
  ];
  const benefits = [
    { icon: ShieldCheck, text: "Haqiqiy imtihon sharoiti va vaqti" },
    { icon: Zap, text: "To'lovdan so'ng darhol ochiladi" },
    { icon: Sparkles, text: "3 tilda, har safar yangi savollar" },
  ];
  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-zoom-in relative w-full max-w-sm rounded-3xl border border-line/15 bg-card p-7 text-center shadow-glass"
      >
        <button
          onClick={onClose}
          disabled={purchasing}
          className="absolute right-4 top-4 text-muted transition hover:text-ink disabled:opacity-40"
          aria-label="Yopish"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-blue-900 shadow-glow ring-1 ring-white/10">
          <CreditCard className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-ink">Real imtihon to'lovi</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
          Haqiqiy DYHHX imtihoni sharoiti. Har bir kirish — bir martalik to'lov.
        </p>

        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className={cn(
            "my-5 overflow-hidden rounded-2xl py-4 transition-colors duration-300",
            appliedPromo ? "bg-success/10" : "bg-accent/10"
          )}
        >
          {appliedPromo && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="text-sm font-medium text-muted line-through"
            >
              {originalPriceStr} so'm
            </motion.div>
          )}
          <motion.div
            key={effectivePrice}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className={cn(
              "text-3xl font-extrabold",
              appliedPromo ? "text-success" : "text-ink"
            )}
          >
            {priceStr} <span className="text-lg font-bold text-muted">so'm</span>
          </motion.div>
          <div className={cn("text-xs", appliedPromo ? "text-success" : "text-muted")}>
            {appliedPromo
              ? `-${appliedPromo.discountPercent}% chegirma qo'llandi`
              : "bir martalik kirish"}
          </div>
        </motion.div>

        {/* Chegirma promokodi (ixtiyoriy) — admin yaratgan */}
        <div className="mb-5 text-left">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Ticket className="h-3.5 w-3.5" />
            Promokod (ixtiyoriy)
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                className={cn(
                  "input w-full font-mono uppercase tracking-wider transition-colors duration-200",
                  appliedPromo && "border-success/60 bg-success/5 pr-9",
                  promoError && !appliedPromo && "border-danger/60"
                )}
                placeholder="Chegirma kodi"
                maxLength={32}
                value={promoInput}
                onChange={(e) => onPromoInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onApplyPromo();
                  }
                }}
                disabled={purchasing}
              />
              {appliedPromo && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-success text-white"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.span>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onApplyPromo}
              disabled={checkingPromo || purchasing || !promoInput.trim()}
              className="btn-ghost shrink-0 px-4 disabled:opacity-50"
            >
              {checkingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Qo'llash"}
            </motion.button>
          </div>

          {appliedPromo && (
            <motion.div
              key={`applied-${appliedPromo.code}`}
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-2 flex items-center gap-2 overflow-hidden rounded-xl bg-success/10 px-3 py-2"
            >
              <Gift className="h-4 w-4 shrink-0 text-success" />
              <p className="text-xs font-medium text-success">
                «{appliedPromo.code}» qo'llandi — {appliedPromo.discountPercent}% chegirma
              </p>
            </motion.div>
          )}

          {promoError && !appliedPromo && (
            <motion.div
              key={promoError.message}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "mt-2 flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2",
                promoError.alreadyUsed ? "bg-warning/10" : "bg-danger/10"
              )}
            >
              <AlertCircle
                className={cn(
                  "h-4 w-4 shrink-0",
                  promoError.alreadyUsed ? "text-warning" : "text-danger"
                )}
              />
              <p
                className={cn(
                  "text-xs font-medium",
                  promoError.alreadyUsed ? "text-warning" : "text-danger"
                )}
              >
                {promoError.message}
              </p>
            </motion.div>
          )}
        </div>

        <ul className="mb-5 space-y-2 text-left text-sm">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <b.icon className="h-4 w-4" />
              </span>
              <span className="text-ink/90">{b.text}</span>
            </li>
          ))}
        </ul>

        <div className="mb-5">
          <div className="mb-2 text-left text-xs font-medium text-muted">
            To'lov usuli
          </div>
          <div className="grid grid-cols-3 gap-2">
            {methods.map((m) => (
              <button
                key={m.code}
                onClick={() => onMethod(m.code)}
                className={cn(
                  "rounded-xl border-2 py-2.5 text-sm font-semibold transition",
                  method === m.code
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line/20 text-muted hover:text-ink"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bonus bilan sotib olish — to'lov usullari yonida (balans yetsa, chegirmadan keyin) */}
        {bonus >= effectivePrice && effectivePrice > 0 && (
          <button
            onClick={onBonusPay}
            disabled={purchasing}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-400/10 py-3 font-bold text-amber-500 transition hover:bg-amber-400/20 disabled:opacity-60"
          >
            <Gift className="h-5 w-5" />
            Bonus bilan sotib olish · {bonus.toLocaleString("ru-RU")} so'm
          </button>
        )}

        <button
          onClick={onPay}
          disabled={purchasing}
          className="btn-primary w-full py-3 text-base shadow-glow"
        >
          {purchasing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              To'lov amalga oshmoqda...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              {priceStr} so'm to'lash
            </>
          )}
        </button>
        <p className="mt-3 text-[11px] text-muted">
          🔒 Xavfsiz to'lov · To'lovdan so'ng imtihon darhol boshlanadi
        </p>
        <button
          onClick={onClose}
          disabled={purchasing}
          className="mx-auto mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Orqaga
        </button>
      </div>
    </div>
  );
}

export function RealExamPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uiContentLang = useUiStore((s) => s.contentLang);
  const uiLang = useUiStore((s) => s.uiLang);
  const authUser = useAuth((s) => s.user); // faqat ma'lumot satri uchun (ism)

  // Selektorlar bilan — timeLeftSec/tick bu yerda yo'q.
  const session = useRealExam((s) => s.session);
  const contentLang = useRealExam((s) => s.contentLang);
  const currentIndex = useRealExam((s) => s.currentIndex);
  const selected = useRealExam((s) => s.selected);
  const confirmed = useRealExam((s) => s.confirmed);
  const feedback = useRealExam((s) => s.feedback);
  const shuffles = useRealExam((s) => s.shuffles);
  const status = useRealExam((s) => s.status);
  const result = useRealExam((s) => s.result);
  const init = useRealExam((s) => s.init);
  const setLang = useRealExam((s) => s.setLang);
  const visit = useRealExam((s) => s.visit);
  // next() bu yerda obuna orqali emas — F-tugma handlerlarida getState() bilan chaqiriladi.
  const selectOption = useRealExam((s) => s.selectOption);
  const confirm = useRealExam((s) => s.confirm);
  const setFeedback = useRealExam((s) => s.setFeedback);
  const setResult = useRealExam((s) => s.setResult);
  const reset = useRealExam((s) => s.reset);

  const [mode, setMode] = useState<ExamMode | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // Har renderda yangilanadi -> F-tugma handleri (getState bilan ishlaydi) modal ochiqligini biladi.
  const modalOpenRef = useRef(false);
  modalOpenRef.current = confirmOpen || finishConfirmOpen || exitConfirmOpen;
  const [finishing, setFinishing] = useState(false);
  const [examHidden, setExamHidden] = useState(false);

  // Tasdiqdan keyin avto-o'tish taymeri (rang ko'ringach keyingi savol)
  const advanceTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    []
  );

  const startExam = async (lang: ContentLang, count: number) => {
    setLoading(true);
    try {
      reset();
      const s = await realExamApi.start(count);
      // Imtihon 3 tilda: O'zbek (lotin) / Ўзбек (кирилл) / Русский — savol bazasi 3 tilli.
      init(s, lang);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    const st = useRealExam.getState();
    if (!st.session || finishing || st.status === "finished") return;
    setFinishing(true);
    try {
      const r = await realExamApi.finish(st.session.sessionId);
      setResult(r);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setFinishing(false);
    }
  };

  // Javobni tasdiqlash (modal «Ha» yoki F-tugma 2-bosishi) → to'q yashil/qizil.
  const doConfirm = async (oid: string) => {
    const st = useRealExam.getState();
    if (!st.session) return;
    const q = st.session.questions[st.currentIndex];
    if (!q || st.confirmed[q.questionId]) return;
    setConfirmOpen(false);
    confirm(q.questionId);
    try {
      const res = await realExamApi.answer(st.session.sessionId, q.questionId, oid);
      setFeedback(q.questionId, res.correctOptionId, res.isCorrect);
      // Avto-yiqilish: xatolar soni ruxsat etilgan me'yordan oshsa → imtihon tugaydi.
      const after = useRealExam.getState();
      const wrong = Object.values(after.feedback).filter((f) => !f.isCorrect).length;
      const maxMistakes = after.session?.passMaxMistakes ?? 2;
      if (wrong > maxMistakes && after.status === "in_progress") {
        toast.error("Xatolar me'yordan oshdi — imtihon yakunlandi");
        window.setTimeout(() => handleFinish(), 1400); // qizil javob ko'ringach natija
        return;
      }
      // Avto-o'tish: tasdiqlangach (to'g'ri ham, xato ham) rang ko'ringach keyingi savol.
      const fromIndex = st.currentIndex;
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => {
        const cur = useRealExam.getState();
        if (cur.status !== "in_progress") return;
        if (cur.currentIndex !== fromIndex) return; // foydalanuvchi o'zi boshqa savolga o'tgan
        if (fromIndex < (cur.session?.questions.length ?? 0) - 1) cur.next();
      }, 1000);
    } catch {
      /* keep silent during exam */
    }
  };

  // Klaviatura F1..FN: 1-bosish — tanlaydi, 2-bosish — modalsiz tasdiqlaydi.
  // F6 — oldingi savol, F7 — keyingi savol (oxirgisida yakunlash tasdig'i).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = /^F([1-9])$/.exec(e.key);
      if (!m) return;
      if (modalOpenRef.current) return; // modal ochiq bo'lsa F-tugmalar orqa savolga ta'sir qilmasin
      const st = useRealExam.getState();
      if (!st.session || st.status !== "in_progress") return;
      // F6/F7 — navigatsiya (pastdagi «Oldingi»/«Keyingi» tugmalari bilan bir xil)
      if (e.key === "F6") {
        e.preventDefault();
        st.visit(st.currentIndex - 1);
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        if (st.currentIndex >= st.session.questions.length - 1) setFinishConfirmOpen(true);
        else st.next();
        return;
      }
      const q = st.session.questions[st.currentIndex];
      if (!q) return;
      const ord = st.shuffles[q.questionId] ?? q.options.map((o) => o.optionId);
      const idx = Number(m[1]) - 1;
      if (idx < 0 || idx >= ord.length) return;
      e.preventDefault();
      if (st.confirmed[q.questionId]) return;
      const oid = ord[idx];
      if (st.selected[q.questionId] === oid) doConfirm(oid);
      else st.selectOption(q.questionId, oid);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Brauzer "orqaga" tugmasi — imtihondan to'g'ridan chiqarmaydi; "Haqiqatan
  // chiqasizmi?" tasdiq modali chiqadi (faqat imtihon davom etayotganda).
  useEffect(() => {
    if (status !== "in_progress") return;
    window.history.pushState(null, "", window.location.href);
    const onPop = () => {
      window.history.pushState(null, "", window.location.href); // joyida ushlab turamiz
      setExitConfirmOpen(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [status]);

  // Anti-cheat — FAQAT imtihon davom etayotganda (in_progress):
  // boshqa oynaga o'tish / skrinshot / nusxalashni cheklaydi. Sahifadan
  // chiqilganda (cleanup) butunlay o'chadi — shu bo'limdan tashqarida ishlamaydi.
  useEffect(() => {
    if (status !== "in_progress") return;

    const clearClip = () => {
      try {
        navigator.clipboard?.writeText("");
      } catch {
        /* ignore */
      }
    };
    const onBlur = () => setExamHidden(true);
    const onFocus = () => setExamHidden(false);
    const onVisibility = () => setExamHidden(document.hidden);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        clearClip();
        setExamHidden(true);
        window.setTimeout(() => setExamHidden(document.hidden), 1200);
      }
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "p", "s", "u"].includes(k)) {
        e.preventDefault();
      }
    };
    const block = (e: Event) => e.preventDefault();

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      setExamHidden(false);
    };
  }, [status]);

  if (loading) return <PageLoader />;
  if (!session) {
    // 1-bosqich: imtihon turini tanlash (20 yoki 50 savol).
    if (!mode)
      return (
        <ModeSelectScreen
          uiLang={uiLang}
          onPick={setMode}
          onBack={() => navigate("/dashboard")}
        />
      );
    // 2-bosqich: tanlangan turga mos boshlash ekrani.
    return (
      <StartScreen
        cfg={MODE_CFG[mode]}
        onStart={() => startExam(uiContentLang, MODE_CFG[mode].count)}
        onBack={() => setMode(null)}
      />
    );
  }

  const tx = EXAM_TXT[contentLang] ?? EXAM_TXT.uz;
  const currentQ = session.questions[currentIndex];
  if (!currentQ) {
    // Bazada yetarli savol bo'lmasa (bo'sh sessiya) — oq ekran o'rniga toza xabar.
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted">
        Imtihon savollari topilmadi. Iltimos, qayta urinib ko'ring.
      </div>
    );
  }
  const order = shuffles[currentQ.questionId] ?? currentQ.options.map((o) => o.optionId);
  const optById = Object.fromEntries(currentQ.options.map((o) => [o.optionId, o]));
  const isConfirmed = confirmed[currentQ.questionId];
  const selectedId = selected[currentQ.questionId];
  const fb = feedback[currentQ.questionId];
  const total = session.questions.length;
  const imgSrc = currentQ.imageUrl ? assetUrl(currentQ.imageUrl) : NO_IMAGE_SRC;
  const fullName = [authUser?.name, authUser?.surname].filter(Boolean).join(" ");
  const selectedText = selectedId ? pickText(optById[selectedId]?.text, contentLang) : "";

  // Sichqoncha bilan tanlash → tasdiqlash modali (variant nomi bilan).
  const onOptionClick = (oid: string) => {
    if (isConfirmed) return;
    selectOption(currentQ.questionId, oid);
    setConfirmOpen(true);
  };

  const exit = () => {
    reset();
    navigate("/dashboard");
  };

  return (
    <div className="exam-terminal exam-bg relative min-h-screen">
      <ExamBackdrop />

      <div className="sharp-0 relative z-10 flex min-h-screen select-none flex-col px-2 pb-4 pt-2">
        {/* ===== 1-blok: til tablari + ma'lumot satri (chap) | bilet belgisi + burchak tugmalari (o'ng) ===== */}
        <div className="flex items-stretch gap-[3px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[16px]">
            {/* Til tablari — referensdagi 3 til */}
            <div className="flex flex-wrap items-center gap-[3px]">
              {EXAM_LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={cn(
                    "border px-2.5 py-[7px] text-[12px] font-semibold leading-none transition",
                    contentLang === l.code
                      ? "border-[#9fc0ea] bg-[#e8f0fb] text-[#0a2a6b]"
                      : "border-[#3d6bb8] bg-[#12306f] text-[#b8cdec] hover:bg-[#1a3f8a] hover:text-white"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Ma'lumot satri — referensdagi matn: Ism | Toifa- | Tug'ilgan sanasi- */}
            <div className="exam-bar flex flex-1 items-center justify-center px-3 py-[11px]">
              <span className="truncate text-[13px] font-semibold text-white lg:text-[14px]">
                {fullName || "—"} <span className="text-[#7fa6dd]">|</span> Toifa-{" "}
                <span className="text-[#7fa6dd]">|</span> Tug'ilgan sanasi-
              </span>
            </div>
          </div>

          {/* Bilet belgisi — ikkala qatorni egallaydi (referensdagi "A-6" kabi) */}
          <div className="exam-badge exam-display flex w-[88px] shrink-0 items-center justify-center text-[30px] font-bold leading-none text-white lg:w-[112px] lg:text-[38px]">
            A-{total}
          </div>

          {/* Burchak tugmalari: yopish (X) ustida, yakunlash ostida */}
          <div className="flex shrink-0 flex-col items-center gap-[3px]">
            <button
              onClick={() => setExitConfirmOpen(true)}
              aria-label={t("common.back")}
              title={t("common.back")}
              className="flex h-[17px] w-[17px] items-center justify-center border border-[#9fc0ea] bg-[#dfe8f6] text-[#0a2a6b] transition hover:bg-white"
            >
              <X className="h-[11px] w-[11px]" strokeWidth={3} />
            </button>
            <button
              onClick={() => setFinishConfirmOpen(true)}
              disabled={finishing}
              aria-label={tx.finish}
              title={tx.finish}
              className="flex h-[17px] w-[17px] items-center justify-center border border-[#3d6bb8] bg-[#12306f] text-[#b8cdec] transition hover:bg-[#1a3f8a] hover:text-white disabled:opacity-50"
            >
              <Flag className="h-[10px] w-[10px]" />
            </button>
          </div>
        </div>

        {/* ===== 2-blok: savol banneri (to'liq kenglik) ===== */}
        <div className="exam-bar-q mt-[16px] flex items-center justify-center px-4 py-[15px]">
          <h2 className="text-center text-[14px] font-semibold leading-snug text-white lg:text-[16px]">
            {pickText(currentQ.text, contentLang)}
          </h2>
        </div>

        {/* ===== 3-blok: variantlar (chap) + rasm & savol raqamlari (o'ng) ===== */}
        {/* Foizlar konteynerning ICHKI kengligiga nisbatan — referens ekran foizlariga
            (variantlar 35.4%, rasm 49%) mos kelishi uchun kompensatsiya qilingan. */}
        <div className="mt-[38px] flex flex-1 flex-col gap-4 lg:mt-[70px] lg:flex-row lg:items-start lg:gap-[10.2%] lg:pl-[3.6%] lg:pr-[1.8%]">
          {/* Variantlar — F1..FN, och po'lat-ko'k barlar (referensdagi kabi) */}
          <div className="flex w-full flex-col gap-[3px] lg:w-[37.9%]">
            {order.map((oid, i) => {
              const opt = optById[oid];
              if (!opt) return null;
              const isSel = selectedId === oid;
              const correct = isConfirmed && fb && oid === fb.correctOptionId;
              const wrong = isConfirmed && isSel && fb && oid !== fb.correctOptionId;
              return (
                <button
                  key={oid}
                  onClick={() => onOptionClick(oid)}
                  disabled={isConfirmed}
                  className={cn(
                    "exam-opt flex w-full items-stretch overflow-hidden text-left transition-colors",
                    !isConfirmed && isSel && "exam-opt-sel",
                    correct && "exam-opt-ok",
                    wrong && "exam-opt-bad",
                    isConfirmed && !correct && !wrong && "exam-opt-dim"
                  )}
                >
                  <span
                    className={cn(
                      "exam-fkey exam-display flex w-[30px] shrink-0 items-center justify-center text-[11px] font-bold leading-none lg:w-[34px] lg:text-[12px]",
                      !isConfirmed && isSel && "!bg-[#1b4a97]",
                      correct && "!bg-[#1c6d3a]",
                      wrong && "!bg-[#8f2622]",
                      isConfirmed && !correct && !wrong && "!bg-[#16336d]"
                    )}
                  >
                    F{i + 1}
                  </span>
                  <span className="flex-1 px-2.5 py-[6px] text-[12.5px] font-semibold leading-snug lg:text-[13.5px]">
                    {pickText(opt.text, contentLang)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Rasm paneli + tagida savol raqamlari (u bilan bir xil kenglikda) */}
          <div className="flex w-full flex-col lg:flex-1">
            {/* Ramka — referensdagi kabi QAT'IY o'lchamli panel, foni QORA:
                kichik rasm cho'zilmasdan markazda qoladi. */}
            <div className="exam-imgframe relative flex h-[44vh] items-center justify-center overflow-hidden lg:h-[60vh]">
              <div className="flex h-full w-full items-center justify-center">
                <ZoomableImage
                  src={imgSrc}
                  imgClassName="mx-auto max-h-[42vh] w-auto max-w-full object-contain lg:max-h-[58vh]"
                />
              </div>
              {/* Taymer — rasm ustida, o'ng-yuqorida (referensdagi 0:20:20) */}
              <div className="pointer-events-none absolute right-[6px] top-[6px] z-10">
                <ExamTimer onTimeUp={handleFinish} />
              </div>
            </div>

            {/* Savol raqamlari — rasm panelining tagida, bir xil kenglikda.
                Navigatsiya: raqamni bosish (sichqoncha) yoki F6/F7 (klaviatura). */}
            <div
              className="mt-[4px] grid gap-[2px]"
              style={{
                gridTemplateColumns: `repeat(${Math.min(total, 20)}, minmax(0, 1fr))`,
              }}
            >
              {session.questions.map((q, i) => {
                const done = confirmed[q.questionId];
                const f = feedback[q.questionId];
                const isCur = i === currentIndex;
                return (
                  <button
                    key={q.questionId}
                    onClick={() => visit(i)}
                    aria-label={`${i + 1}`}
                    className={cn(
                      "exam-cell exam-display flex h-[19px] items-center justify-center text-[10px] font-semibold leading-none transition lg:h-[22px] lg:text-[11px]",
                      done && (f?.isCorrect ? "exam-cell-ok" : "exam-cell-bad"),
                      !done && isCur && "exam-cell-cur",
                      isCur && "ring-1 ring-[#bff3e0]"
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      {/* Javobni tasdiqlash modali (variant nomi, kontent tilida) */}
      <ConfirmModal
        open={confirmOpen}
        title={tx.confirmWith(selectedText)}
        confirmText={tx.yes}
        cancelText={tx.no}
        onConfirm={() => selectedId && doConfirm(selectedId)}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Imtihonni yakunlash tasdig'i (kontent tilida) → Ha → natija */}
      <ConfirmModal
        open={finishConfirmOpen}
        title={tx.finishConfirm}
        confirmText={tx.yes}
        cancelText={tx.no}
        onConfirm={() => {
          setFinishConfirmOpen(false);
          handleFinish();
        }}
        onCancel={() => setFinishConfirmOpen(false)}
      />

      {/* Imtihondan chiqish tasdig'i (kontent tilida) */}
      <ConfirmModal
        open={exitConfirmOpen}
        danger
        title={tx.exitConfirm}
        confirmText={tx.yes}
        cancelText={tx.no}
        onConfirm={() => {
          setExitConfirmOpen(false);
          exit();
        }}
        onCancel={() => setExitConfirmOpen(false)}
      />

      {/* Anti-cheat to'sig'i — boshqa oynaga o'tilsa / skrinshotda ko'rinadi */}
      {examHidden && (
        <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-4 bg-bg/95 p-6 text-center backdrop-blur-2xl">
          <ShieldAlert className="h-16 w-16 animate-pulse text-danger" />
          <h2 className="text-2xl font-extrabold text-ink">{tx.guardTitle}</h2>
          <p className="max-w-md text-muted">{tx.guardText}</p>
        </div>
      )}

      {/* Natija — zamonaviy + animatsion; pastda faqat asosiy menyu tugmasi */}
      <Modal
        open={status === "finished" && !!result}
        onClose={() => {}}
        className="keep-round max-w-md"
      >
        {result && (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 15 }}
              className="relative mx-auto flex h-24 w-24 items-center justify-center"
            >
              {result.passed && (
                <span className="keep-circle absolute inline-flex h-full w-full animate-ping bg-success/30" />
              )}
              <div
                className={cn(
                  "keep-circle relative flex h-20 w-20 items-center justify-center text-white shadow-glow",
                  result.passed
                    ? "bg-gradient-to-br from-success to-green-700"
                    : "bg-gradient-to-br from-danger to-red-700"
                )}
              >
                {result.passed ? (
                  <Check className="h-11 w-11" strokeWidth={3} />
                ) : (
                  <X className="h-11 w-11" strokeWidth={3} />
                )}
              </div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={cn(
                "mt-5 text-3xl font-extrabold",
                result.passed ? "text-success" : "text-danger"
              )}
            >
              {result.passed ? t("realExam.passed") : t("realExam.failed")}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-2 text-sm text-muted"
            >
              {result.passed
                ? `Tabriklaymiz! Ruxsat etilgan ${session?.passMaxMistakes ?? "-"} ta xatodan oshmadingiz.`
                : `Xatolar me'yordan oshdi: ${result.mistakes} ta xato (ruxsat etilgani — ${session?.passMaxMistakes ?? "-"} ta).`}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-6 grid grid-cols-2 gap-3"
            >
              <div className="border border-success/20 bg-success/10 p-4">
                <div className="text-3xl font-extrabold text-success">{result.correct}</div>
                <div className="mt-1 text-xs text-muted">{t("realExam.correctCount")}</div>
              </div>
              <div className="border border-danger/20 bg-danger/10 p-4">
                <div className="text-3xl font-extrabold text-danger">{result.mistakes}</div>
                <div className="mt-1 text-xs text-muted">{t("realExam.wrongCount")}</div>
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              onClick={exit}
              className="btn-primary mt-7 w-full py-3 text-base shadow-glow"
            >
              <LayoutDashboard className="h-5 w-5" />
              {t("nav.dashboard")}
            </motion.button>
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
}
