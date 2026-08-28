import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  ChevronRight,
  GraduationCap,
  Heart,
  Layers,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  Radio,
  ShieldAlert,
  ShieldX,
  Signpost,
  Sparkles,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/shared/StatCard";
import { AppInstallModal } from "@/components/shared/AppInstallModal";
import { InstallApp } from "@/components/shared/InstallApp";
import { useMeStats } from "@/lib/queries";

/** Bo'lim sarlavhasi — sahifani ko'z bilan bo'laklarga ajratadi. */
function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-accent" />
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
        {children}
      </h2>
    </div>
  );
}

/** Katta, diqqatni tortadigan karta — sahifaning asosiy amallari uchun. */
function FeatureCard({
  icon: Icon,
  title,
  desc,
  badge,
  gradient,
  onClick,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: string;
  gradient: string;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-3xl ${gradient} p-6 text-left text-white shadow-glow ring-1 ring-white/10 transition-transform hover:-translate-y-0.5`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold">{title}</h3>
            {badge && (
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-white/85">{desc}</p>
        </div>
        <ChevronRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
      </div>
    </motion.button>
  );
}

/** Oddiy karta — mashq va qo'shimcha bo'limlar uchun. */
function TileCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="group glass-card glass-hover flex w-full items-center gap-4 p-5 text-left"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow transition-transform duration-300 group-hover:scale-110">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-ink">{title}</div>
        {subtitle && <div className="truncate text-sm text-muted">{subtitle}</div>}
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
    </motion.button>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useMeStats();

  // Mashq bo'limlari — test yechishga olib boradigan barcha yo'llar
  const practice = [
    { icon: Layers, title: t("home.byTopic"), subtitle: t("home.byTopicHint"), to: "/lesson" },
    { icon: ListChecks, title: t("home.byTickets"), subtitle: t("home.byTicketsHint"), to: "/tickets" },
    { icon: ShieldX, title: t("home.myMistakes"), subtitle: t("home.myMistakesHint"), to: "/mistakes" },
    { icon: Heart, title: t("home.myFavorites"), subtitle: t("home.myFavoritesHint"), to: "/lesson/favorites" },
    // Yo'l belgilari yuqoridagi asosiy kartalarda — bu yerda takrorlanmaydi.
  ];

  return (
    <div className="space-y-8">
      {/* Ilovani o'rnatish taklifi — kirgandan keyin BIR MARTA chiqadi */}
      <AppInstallModal />

      {/* Sarlavha */}
      <div>
        <span className="chip bg-accent/15 text-accent">TayyorPrava</span>
        <h1 className="mt-2 text-3xl font-extrabold text-ink">{t("home.title")}</h1>
        <p className="mt-1 text-muted">{t("home.subtitle")}</p>
      </div>

      {/* 1) BU YERDAN BOSHLANG — foydalanuvchi kirishi bilan birinchi ko'radigan bo'lim */}
      <section>
        <SectionTitle icon={Sparkles}>{t("home.sectionStart")}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FeatureCard
            icon={Brain}
            title={t("home.smartTest")}
            desc={t("home.smartTestDesc")}
            badge={t("home.badgeNew")}
            gradient="bg-gradient-to-br from-violet-600 to-fuchsia-700"
            onClick={() => navigate("/smart-test")}
          />
          <FeatureCard
            icon={Signpost}
            title={t("home.roadSigns")}
            desc={t("home.roadSignsHint")}
            gradient="bg-gradient-to-br from-emerald-600 to-teal-700"
            onClick={() => navigate("/road-signs")}
            delay={0.07}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TileCard
            icon={LayoutGrid}
            title={t("nav.exam")}
            subtitle={t("home.examHint")}
            onClick={() => navigate("/exam")}
            delay={0.14}
          />
          <TileCard
            icon={Radio}
            title={t("nav.realExam")}
            subtitle={t("home.realExamDesc")}
            onClick={() => navigate("/real-exam")}
            delay={0.2}
          />
        </div>
      </section>

      {/* 2) MASHQ — savollarni yechish yo'llari */}
      <section>
        <SectionTitle icon={GraduationCap}>{t("home.sectionPractice")}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {practice.map((c, i) => (
            <TileCard
              key={c.to}
              icon={c.icon}
              title={c.title}
              subtitle={c.subtitle}
              onClick={() => navigate(c.to)}
              delay={i * 0.06}
            />
          ))}
        </div>
      </section>

      {/* 3) STATISTIKA */}
      <section>
        <SectionTitle icon={BarChart3}>{t("home.sectionStats")}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={Heart}
            label={t("home.myFavorites")}
            value={stats?.favorites ?? 0}
            loading={isLoading}
            delay={0}
            onClick={() => navigate("/lesson/favorites")}
          />
          <StatCard
            icon={ShieldX}
            label={t("home.myMistakes")}
            value={stats?.mistakes ?? 0}
            loading={isLoading}
            delay={0.08}
            onClick={() => navigate("/mistakes")}
          />
          <StatCard
            icon={ShieldAlert}
            label={t("home.allMistakes")}
            value={stats?.allMistakesPercent ?? 0}
            suffix="%"
            loading={isLoading}
            delay={0.16}
          />
        </div>
      </section>

      {/* 4) QO'SHIMCHA — pastda: ustoz, obuna, ilova va Telegram havolalari */}
      <section>
        <SectionTitle icon={Sparkles}>{t("home.sectionMore")}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TileCard
            icon={GraduationCap}
            title={t("nav.teachers")}
            subtitle={t("home.teachersHint")}
            onClick={() => navigate("/teachers")}
          />
          <TileCard
            icon={Ticket}
            title={t("nav.referral")}
            subtitle={t("home.referralHint")}
            onClick={() => navigate("/referral")}
            delay={0.06}
          />
        </div>

        {/* Ilovani o'rnatish (faqat saytda ko'rinadi) */}
        <div className="mt-4">
          <InstallApp />
        </div>

        {/* Telegram havolalari — eng pastda */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() =>
              window.open("https://t.me/TayyorPrava_bot", "_blank", "noopener,noreferrer")
            }
            className="btn-ghost flex-1 justify-start gap-3 py-3"
          >
            <Bot className="h-5 w-5" />
            <span className="text-sm font-semibold">{t("home.testBot")}</span>
          </button>
          <button
            onClick={() =>
              window.open("https://t.me/TayyorPrava", "_blank", "noopener,noreferrer")
            }
            className="btn-ghost flex-1 justify-start gap-3 py-3"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">{t("home.qaGroup")}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
