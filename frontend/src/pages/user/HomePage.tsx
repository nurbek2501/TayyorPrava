import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  GraduationCap,
  Heart,
  Layers,
  ListChecks,
  MessageCircle,
  Signpost,
  ShieldAlert,
  ShieldX,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/shared/StatCard";
import { InstallApp } from "@/components/shared/InstallApp";
import { useMeStats } from "@/lib/queries";

function QuickAction({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: typeof Bot;
  label: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        primary
          ? "btn-primary flex-1 justify-start gap-3 py-3"
          : "btn-ghost flex-1 justify-start gap-3 py-3"
      }
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useMeStats();

  const practiceCards = [
    { icon: Layers, label: t("home.byTopic"), to: "/lesson" },
    { icon: ListChecks, label: t("home.byTickets"), to: "/tickets" },
    { icon: Signpost, label: t("home.roadSigns"), to: "/road-signs" },
    { icon: Heart, label: t("home.favorites"), to: "/lesson/favorites" },
    { icon: GraduationCap, label: t("nav.teachers"), to: "/teachers" },
  ];

  return (
    <div className="space-y-8">
      {/* Quick actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <QuickAction
          icon={Bot}
          label={t("home.testBot")}
          onClick={() =>
            window.open("https://t.me/TayyorPrava_bot", "_blank", "noopener,noreferrer")
          }
        />
        <QuickAction
          icon={MessageCircle}
          label={t("home.qaGroup")}
          onClick={() =>
            window.open("https://t.me/TayyorPrava", "_blank", "noopener,noreferrer")
          }
        />
        <QuickAction
          icon={Sparkles}
          label={t("nav.subscribe")}
          primary
          onClick={() => navigate("/payment")}
        />
      </div>

      {/* Ilova — telefon ekraniga o'rnatish (faqat saytda; ilovada ko'rinmaydi) */}
      <InstallApp />

      {/* Title */}
      <div>
        <span className="chip bg-accent/15 text-accent">TayyorPrava</span>
        <h1 className="mt-2 text-3xl font-extrabold text-ink">{t("home.title")}</h1>
        <p className="mt-1 text-muted">{t("home.subtitle")}</p>
      </div>

      {/* Stats — sevimli va xato kartalari bosiladi */}
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

      {/* Practice cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {practiceCards.map((c, i) => (
          <motion.button
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.07, type: "spring", stiffness: 260, damping: 22 }}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(c.to)}
            className="group glass-card glass-hover flex items-center gap-4 p-6 text-left"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <c.icon className="h-7 w-7" />
            </div>
            <span className="text-lg font-bold text-ink">{c.label}</span>
            <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-muted opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
