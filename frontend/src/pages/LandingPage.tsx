import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Languages,
  LogIn,
  Menu,
  Phone,
  Radio,
  Send,
  ShieldX,
  Smartphone,
  Sparkles,
  Star,
  Target,
  UserPlus,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { landingApi, tariffsApi } from "@/lib/api";
import { useUiStore } from "@/store/ui";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/lib/useCountUp";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import type { UiLang } from "@/lib/types";

const LANDING_T: Record<UiLang, any> = {
  uz: {
    heroBadge: "🚗 O'zbekistondagi #1 avtotest platformasi",
    heroTitle: "Haydovchilik guvohnomasini birinchi",
    heroTitleAccent: "urinishda oling",
    heroSubtitle:
      "Real imtihon simulyatori, 3 tilli savollar, xatolar ustida ishlash va shaxsiy statistika — barchasi bitta zamonaviy platformada.",
    heroCta: "Bepul boshlash",
    back: "Bosh sahifa",
    navFeatures: "Imkoniyatlar",
    navHow: "Qanday ishlaydi",
    navPricing: "Tariflar",
    login: "Kirish",
    signup: "Ro'yxatdan o'tish",
    dashboard: "Kabinet",
    statQuestions: "Savol bazasi",
    statUsers: "Foydalanuvchi",
    statExams: "Topshirilgan imtihon",
    statPass: "O'tish darajasi",
    whyTitle: "Nega aynan TayyorPrava?",
    whySub: "Imtihonga professional tayyorgarlik uchun kerak bo'lgan barcha vositalar — bir joyda.",
    features: [
      { t: "Real imtihon simulyatori", d: "Haqiqiy imtihon sharoiti: 20 savol, 25 daqiqa teskari taymer va aniq natija." },
      { t: "3 tilli savollar", d: "O'zbek lotin va kirill tillarida — qulayini bir tugma bilan tanlang." },
      { t: "Xatolar ustida ishlash", d: "Har bir xato savol saqlanadi — qayta yechib, bilimni mustahkamlaysiz." },
      { t: "Shaxsiy statistika", d: "O'sishingizni kuzating: o'tish darajasi, xatolar va umumiy progress." },
      { t: "Mavzular bo'yicha mashq", d: "42+ mavzu va biletlar bo'yicha cheksiz mashq qiling." },
      { t: "Istalgan qurilmada", d: "Telefon, planshet va kompyuterda — to'liq moslashuvchan interfeys." },
    ],
    howTitle: "Bor-yo'g'i 3 qadam",
    howSub: "Bugun boshlang va guvohnomaga yaqinlashing.",
    steps: [
      { t: "Ro'yxatdan o'ting", d: "Bir daqiqada bepul hisob yarating." },
      { t: "Mashq qiling", d: "Mavzular va biletlar bo'yicha tayyorlaning." },
      { t: "Imtihon topshiring", d: "Real imtihonda bilimingizni sinab ko'ring." },
    ],
    pricingTitle: "Sodda va shaffof tariflar",
    pricingSub: "O'zingizga mos rejani tanlang.",
    popular: "Ommabop",
    perDays: "kun",
    free: "Bepul",
    choose: "Tanlash",
    som: "so'm",
    ctaTitle: "Guvohnoma — bir qadam naridagina",
    ctaSub: "Minglab haydovchilar allaqachon biz bilan tayyorlanmoqda. Siz ham qo'shiling!",
    ctaBtn: "Hoziroq boshlash",
    footerTag: "Haydovchilik guvohnomasi uchun zamonaviy avtotest platformasi.",
    footerContact: "Bog'lanish",
    rights: "Barcha huquqlar himoyalangan.",
  },
  kr: {
    heroBadge: "🚗 Ўзбекистондаги #1 автотест платформаси",
    heroTitle: "Ҳайдовчилик гувоҳномасини биринчи",
    heroTitleAccent: "уринишда олинг",
    heroSubtitle:
      "Реал имтиҳон симулятори, 3 тилли саволлар, хатолар устида ишлаш ва шахсий статистика — барчаси битта замонавий платформада.",
    heroCta: "Бепул бошлаш",
    back: "Бош саҳифа",
    navFeatures: "Имкониятлар",
    navHow: "Қандай ишлайди",
    navPricing: "Тарифлар",
    login: "Кириш",
    signup: "Рўйхатдан ўтиш",
    dashboard: "Кабинет",
    statQuestions: "Савол базаси",
    statUsers: "Фойдаланувчи",
    statExams: "Топширилган имтиҳон",
    statPass: "Ўтиш даражаси",
    whyTitle: "Нега айнан TayyorPrava?",
    whySub: "Имтиҳонга профессионал тайёргарлик учун керакли барча воситалар — бир жойда.",
    features: [
      { t: "Реал имтиҳон симулятори", d: "Ҳақиқий имтиҳон шароити: 20 савол, 25 дақиқа тескари таймер ва аниқ натижа." },
      { t: "3 тилли саволлар", d: "Ўзбек лотин ва кирилл тилларида — қулайини бир тугма билан танланг." },
      { t: "Хатолар устида ишлаш", d: "Ҳар бир хато савол сақланади — қайта ечиб, билимни мустаҳкамлайсиз." },
      { t: "Шахсий статистика", d: "Ўсишингизни кузатинг: ўтиш даражаси, хатолар ва умумий прогресс." },
      { t: "Мавзулар бўйича машқ", d: "42+ мавзу ва билетлар бўйича чексиз машқ қилинг." },
      { t: "Исталган қурилмада", d: "Телефон, планшет ва компьютерда — тўлиқ мослашувчан интерфейс." },
    ],
    howTitle: "Бор-йўғи 3 қадам",
    howSub: "Бугун бошланг ва гувоҳномага яқинлашинг.",
    steps: [
      { t: "Рўйхатдан ўтинг", d: "Бир дақиқада бепул ҳисоб яратинг." },
      { t: "Машқ қилинг", d: "Мавзулар ва билетлар бўйича тайёрланинг." },
      { t: "Имтиҳон топширинг", d: "Реал имтиҳонда билимингизни синаб кўринг." },
    ],
    pricingTitle: "Содда ва шаффоф тарифлар",
    pricingSub: "Ўзингизга мос режани танланг.",
    popular: "Оммабоп",
    perDays: "кун",
    free: "Бепул",
    choose: "Танлаш",
    som: "сўм",
    ctaTitle: "Гувоҳнома — бир қадам наридагина",
    ctaSub: "Минглаб ҳайдовчилар аллақачон биз билан тайёрланмоқда. Сиз ҳам қўшилинг!",
    ctaBtn: "Ҳозироқ бошлаш",
    footerTag: "Ҳайдовчилик гувоҳномаси учун замонавий автотест платформаси.",
    footerContact: "Боғланиш",
    rights: "Барча ҳуқуқлар ҳимояланган.",
  },
  ru: {
    heroBadge: "🚗 Платформа автотестов #1 в Узбекистане",
    heroTitle: "Получите водительские права с",
    heroTitleAccent: "первой попытки",
    heroSubtitle:
      "Симулятор реального экзамена, вопросы на 3 языках, работа над ошибками и личная статистика — всё на одной современной платформе.",
    heroCta: "Начать бесплатно",
    back: "На главную",
    navFeatures: "Возможности",
    navHow: "Как это работает",
    navPricing: "Тарифы",
    login: "Войти",
    signup: "Регистрация",
    dashboard: "Кабинет",
    statQuestions: "База вопросов",
    statUsers: "Пользователей",
    statExams: "Сдано экзаменов",
    statPass: "Процент сдачи",
    whyTitle: "Почему именно TayyorPrava?",
    whySub: "Все инструменты для профессиональной подготовки к экзамену — в одном месте.",
    features: [
      { t: "Симулятор реального экзамена", d: "Реальные условия: 20 вопросов, 25 минут, обратный таймер и точный результат." },
      { t: "Вопросы на 3 языках", d: "Узбекский латиница и кириллица — выберите удобный одним нажатием." },
      { t: "Работа над ошибками", d: "Каждый неверный вопрос сохраняется — решайте заново и закрепляйте знания." },
      { t: "Личная статистика", d: "Следите за ростом: процент сдачи, ошибки и общий прогресс." },
      { t: "Практика по темам", d: "Безлимитная практика по 42+ темам и билетам." },
      { t: "На любом устройстве", d: "Телефон, планшет и компьютер — полностью адаптивный интерфейс." },
    ],
    howTitle: "Всего 3 шага",
    howSub: "Начните сегодня и приблизьтесь к правам.",
    steps: [
      { t: "Зарегистрируйтесь", d: "Создайте бесплатный аккаунт за минуту." },
      { t: "Практикуйтесь", d: "Готовьтесь по темам и билетам." },
      { t: "Сдайте экзамен", d: "Проверьте знания на реальном экзамене." },
    ],
    pricingTitle: "Простые и прозрачные тарифы",
    pricingSub: "Выберите подходящий план.",
    popular: "Популярный",
    perDays: "дней",
    free: "Бесплатно",
    choose: "Выбрать",
    som: "сум",
    ctaTitle: "Права — всего в одном шаге",
    ctaSub: "Тысячи водителей уже готовятся с нами. Присоединяйтесь!",
    ctaBtn: "Начать сейчас",
    footerTag: "Современная платформа автотестов для водительских прав.",
    footerContact: "Контакты",
    rights: "Все права защищены.",
  },
};

// Reveal-on-scroll — kontent doim ko'rinadi (opacity bilan ham, lekin
// IntersectionObserver odatdagidek ishonchli ishlaydi).
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StatCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const v = useCountUp(value, 1400);
  return (
    <span>
      {Math.round(v).toLocaleString()}
      {suffix}
    </span>
  );
}

const FEATURE_ICONS = [Radio, Languages, ShieldX, BarChart3, GraduationCap, Smartphone];

export function LandingPage() {
  const navigate = useNavigate();
  const uiLang = useUiStore((s) => s.uiLang);
  const token = useAuth((s) => s.token);
  const tt = LANDING_T[uiLang] ?? LANDING_T.uz;
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: landing } = useQuery({ queryKey: ["landing"], queryFn: landingApi.get });
  const { data: tariffs } = useQuery({ queryKey: ["tariffs"], queryFn: tariffsApi.listActive });

  // Barcha matn tanlangan tilda (LANDING_T). Backend faqat jonli statistika va
  // aloqa ma'lumotlari uchun ishlatiladi.
  const stats = landing?.stats ?? { questions: 0, users: 0, exams: 0, passRate: 0 };

  const goPrimary = () => navigate(token ? "/dashboard" : "/register");

  const statItems = [
    { value: stats.questions, suffix: "+", label: tt.statQuestions, icon: GraduationCap },
    { value: stats.users, suffix: "+", label: tt.statUsers, icon: UserPlus },
    { value: stats.exams, suffix: "+", label: tt.statExams, icon: Radio },
    { value: Math.round(stats.passRate), suffix: "%", label: tt.statPass, icon: Target },
  ];

  const sortedTariffs = [...(tariffs ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const popularIdx = sortedTariffs.length ? Math.min(1, sortedTariffs.length - 1) : -1;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Decorative animated background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-[-10%] h-[28rem] w-[28rem] animate-blob-drift rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute right-[-15%] top-[20%] h-[32rem] w-[32rem] animate-blob-drift rounded-full bg-blue-900/25 blur-[130px] [animation-delay:-6s]" />
        <div className="absolute bottom-[-10%] left-1/3 h-[26rem] w-[26rem] animate-blob-drift rounded-full bg-accent-dark/20 blur-[120px] [animation-delay:-12s]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-line/10 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted lg:flex">
            <a href="#features" className="transition hover:text-ink">{tt.navFeatures}</a>
            <a href="#how" className="transition hover:text-ink">{tt.navHow}</a>
            <a href="#pricing" className="transition hover:text-ink">{tt.navPricing}</a>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ThemeSwitcher />
            </div>
            <div className="hidden md:block">
              <LangSwitcher />
            </div>
            {token ? (
              <Link to="/dashboard" className="btn-primary">
                {tt.dashboard}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost hidden sm:inline-flex">
                  <LogIn className="h-4 w-4" />
                  {tt.login}
                </Link>
                <Link to="/register" className="btn-primary">
                  <span className="hidden sm:inline">{tt.signup}</span>
                  <span className="sm:hidden">{tt.login}</span>
                </Link>
              </>
            )}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="btn-ghost p-2 lg:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-line/10 bg-bg/95 px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-1 text-sm font-medium">
              <a href="#features" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-muted hover:bg-card/70 hover:text-ink">{tt.navFeatures}</a>
              <a href="#how" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-muted hover:bg-card/70 hover:text-ink">{tt.navHow}</a>
              <a href="#pricing" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-muted hover:bg-card/70 hover:text-ink">{tt.navPricing}</a>
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <LangSwitcher />
                <ThemeSwitcher />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            {tt.heroBadge}
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {tt.heroTitle}{" "}
            <span className="bg-gradient-to-r from-accent via-blue-500 to-accent-dark bg-clip-text text-transparent">
              {tt.heroTitleAccent}
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{tt.heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={goPrimary} className="btn-primary px-6 py-3 text-base shadow-glow">
              {token ? tt.dashboard : tt.heroCta}
              <ArrowRight className="h-5 w-5" />
            </button>
            {!token && (
              <Link to="/login" className="btn-ghost px-6 py-3 text-base">
                <LogIn className="h-5 w-5" />
                {tt.login}
              </Link>
            )}
          </div>
          <div className="mt-8 flex items-center gap-5 text-sm text-muted">
            <div className="flex -space-x-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-bg bg-gradient-to-br from-accent to-accent-dark text-[11px] font-bold text-white"
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-warning text-warning" />
              ))}
              <span className="ml-1 font-semibold text-ink">
                <StatCounter value={stats.users} suffix="+" />
              </span>
              <span>{tt.statUsers.toLowerCase()}</span>
            </div>
          </div>
        </motion.div>

        {/* Floating mock visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="relative hidden h-[420px] lg:block"
        >
          <div className="absolute right-4 top-2 w-[330px] animate-float-slow glass-card p-5 shadow-glass">
            <span className="chip bg-accent/15 text-accent">7 / 20 savol</span>
            <p className="mt-3 text-sm font-bold leading-snug text-ink">
              Chorrahaga yaqinlashganda haydovchi nima qilishi kerak?
            </p>
            <div className="mt-3 space-y-2">
              {[
                { l: "F1", t: "To'xtab, yo'l berish", ok: false },
                { l: "F2", t: "Tezlikni oshirish", ok: false },
                { l: "F3", t: "Belgi talabiga amal qilish", ok: true },
              ].map((o) => (
                <div
                  key={o.l}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-2.5 text-xs",
                    o.ok ? "border-success/50 bg-success/10 text-ink" : "border-line/15 bg-card/40 text-muted"
                  )}
                >
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white", o.ok ? "bg-success" : "bg-accent/80")}>
                    {o.l}
                  </span>
                  <span className="flex-1">{o.t}</span>
                  {o.ok && <Check className="h-4 w-4 text-success" />}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute left-0 top-32 animate-float flex items-center gap-2 rounded-2xl border border-line/10 bg-card/80 px-4 py-3 shadow-glass backdrop-blur-xl [animation-delay:-2s]">
            <Clock className="h-5 w-5 text-accent" />
            <span className="text-lg font-extrabold text-ink">24:13</span>
          </div>
          <div className="absolute bottom-6 left-6 animate-float-x flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 shadow-glass backdrop-blur-xl [animation-delay:-4s]">
            <CheckCircle2 className="h-7 w-7 text-success" />
            <div>
              <div className="text-sm font-bold text-ink">Imtihon o'tdi!</div>
              <div className="text-xs text-muted">18/20 to'g'ri</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats band */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="grid grid-cols-2 gap-4 rounded-3xl border border-line/10 bg-card/40 p-6 backdrop-blur-xl sm:grid-cols-4 sm:p-8">
          {statItems.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className="mx-auto mb-2 h-6 w-6 text-accent" />
              <div className="text-3xl font-extrabold text-ink sm:text-4xl">
                <StatCounter value={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-1 text-xs text-muted sm:text-sm">{s.label}</div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-ink sm:text-4xl">{tt.whyTitle}</h2>
          <p className="mt-3 text-muted">{tt.whySub}</p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tt.features.map((f: { t: string; d: string }, i: number) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
            return (
              <Reveal key={f.t} delay={(i % 3) * 0.08}>
                <div className="group h-full rounded-2xl border border-line/10 bg-card/50 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-glow">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-ink">{f.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-ink sm:text-4xl">{tt.howTitle}</h2>
          <p className="mt-3 text-muted">{tt.howSub}</p>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {tt.steps.map((s: { t: string; d: string }, i: number) => (
            <Reveal key={s.t} delay={i * 0.1}>
              <div className="relative h-full rounded-2xl border border-line/10 bg-card/50 p-6 backdrop-blur-xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-xl font-extrabold text-accent">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink">{s.t}</h3>
                <p className="mt-2 text-sm text-muted">{s.d}</p>
                {i < tt.steps.length - 1 && (
                  <ChevronRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-accent/40 md:block" />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-ink sm:text-4xl">{tt.pricingTitle}</h2>
          <p className="mt-3 text-muted">{tt.pricingSub}</p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedTariffs.map((tar, i) => {
            const popular = i === popularIdx;
            return (
              <Reveal key={tar.id} delay={(i % 3) * 0.08}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5",
                    popular
                      ? "border-accent/50 bg-gradient-to-b from-accent/15 to-card/50 shadow-glow"
                      : "border-line/10 bg-card/50 hover:border-accent/30"
                  )}
                >
                  {popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-accent to-accent-dark px-3 py-1 text-[11px] font-bold text-white shadow-glow">
                      {tt.popular}
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-ink">{tar.title}</h3>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-3xl font-extrabold text-ink">
                      {tar.price > 0 ? tar.price.toLocaleString() : tt.free}
                    </span>
                    {tar.price > 0 && <span className="pb-1 text-sm text-muted">{tt.som}</span>}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {tar.durationDays} {tt.perDays}
                  </div>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {[tt.statQuestions, tt.statExams, tt.statPass].map((feat: string) => (
                      <li key={feat} className="flex items-center gap-2 text-muted">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate(token ? "/payment" : "/register")}
                    className={cn("mt-6 w-full", popular ? "btn-primary shadow-glow" : "btn-ghost")}
                  >
                    {tt.choose}
                  </button>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/25 via-blue-900/20 to-accent-dark/25 p-8 text-center shadow-glow sm:p-14">
            <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 animate-float rounded-full bg-accent/20 blur-3xl" />
            <h2 className="relative text-3xl font-extrabold text-ink sm:text-4xl">{tt.ctaTitle}</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-muted">{tt.ctaSub}</p>
            <button onClick={goPrimary} className="btn-primary relative mt-7 px-8 py-3.5 text-base shadow-glow">
              {tt.ctaBtn}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-line/10 bg-bg/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-3 text-sm text-muted">{tt.footerTag}</p>
          </div>
          <div>
            <div className="mb-3 text-sm font-bold text-ink">{tt.footerContact}</div>
            <div className="space-y-2 text-sm text-muted">
              {landing?.phone && (
                <a href={`tel:${landing.phone}`} className="flex items-center gap-2 transition hover:text-ink">
                  <Phone className="h-4 w-4 text-accent" />
                  {landing.phone}
                </a>
              )}
              {landing?.telegram && (
                <a
                  href={`https://t.me/${landing.telegram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 transition hover:text-ink"
                >
                  <Send className="h-4 w-4 text-accent" />
                  {landing.telegram}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-line/10 px-4 py-5 text-center text-xs text-muted">
          © {new Date().getFullYear()} {landing?.siteName ?? "TayyorPrava"}. {tt.rights}
        </div>
      </footer>
    </div>
  );
}
