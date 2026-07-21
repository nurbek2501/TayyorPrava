import { motion } from "framer-motion";
import {
  Activity,
  CreditCard,
  DollarSign,
  GraduationCap,
  Gift,
  ListChecks,
  RefreshCw,
  Send,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/shared/StatCard";
import { useDashboardSummary } from "@/lib/queries";
import { useCountUp } from "@/lib/useCountUp";
import { cn, formatNumber } from "@/lib/utils";

/** Yuqoridagi yirik gradientli karta (asosiy ko'rsatkichlar). */
function FeatureCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  gradient,
  delay = 0,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  gradient: string;
  delay?: number;
  loading?: boolean;
}) {
  const animated = useCountUp(loading ? 0 : value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16, delay }}
      whileHover={{ scale: 1.02, y: -3 }}
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 text-white shadow-glow ring-1 ring-white/10",
        gradient
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="relative mt-4">
        {loading ? (
          <div className="skeleton h-10 w-28 bg-white/20" />
        ) : (
          <div className="text-3xl font-extrabold tabular-nums sm:text-4xl">
            {formatNumber(animated)}
            {suffix}
          </div>
        )}
        <div className="mt-1 text-sm font-medium text-white/85">{label}</div>
      </div>
    </motion.div>
  );
}

function SectionTitle({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.h2
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="text-sm font-bold uppercase tracking-wider text-muted"
    >
      {children}
    </motion.h2>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const summary = useDashboardSummary();
  const s = summary.data;
  const loading = summary.isLoading;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-extrabold text-ink"
        >
          {t("admin.dashboard")}
        </motion.h1>
        <button
          onClick={() => qc.invalidateQueries()}
          className="btn-ghost p-2.5"
          aria-label="Yangilash"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Asosiy ko'rsatkichlar — yirik gradientli kartalar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={Users}
          label="Jami foydalanuvchilar"
          value={s?.totalUsers ?? 0}
          gradient="bg-gradient-to-br from-blue-600 to-indigo-800"
          loading={loading}
          delay={0}
        />
        <FeatureCard
          icon={DollarSign}
          label="Jami daromad (so'm)"
          value={s?.totalRevenue ?? 0}
          gradient="bg-gradient-to-br from-emerald-500 to-green-700"
          loading={loading}
          delay={0.08}
        />
        <FeatureCard
          icon={CreditCard}
          label="Real imtihon daromadi (so'm)"
          value={s?.realExamRevenue ?? 0}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          loading={loading}
          delay={0.16}
        />
      </div>

      {/* Foydalanuvchilar va to'lovlar */}
      <div className="space-y-3">
        <SectionTitle>Foydalanuvchilar va to'lovlar</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard icon={UserPlus} label="Bugungi yangi" value={s?.newUsersToday ?? 0} loading={loading} delay={0} />
          <StatCard icon={Send} label="Telegram bog'langan" value={s?.telegramBound ?? 0} loading={loading} delay={0.05} />
          <StatCard icon={Gift} label="Promokod ro'yxat" value={s?.referralSignups ?? 0} loading={loading} delay={0.1} />
          <StatCard icon={Wallet} label="Bugungi to'lovlar" value={s?.todayPayments ?? 0} loading={loading} delay={0.15} />
          <StatCard icon={CreditCard} label="Real imtihon kirishlari" value={s?.realExamEntries ?? 0} loading={loading} delay={0.2} />
        </div>
      </div>

      {/* Imtihonlar va savollar */}
      <div className="space-y-3">
        <SectionTitle delay={0.05}>Imtihonlar va savollar</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={ListChecks} label="Jami savollar" value={s?.totalQuestions ?? 0} loading={loading} delay={0} />
          <StatCard icon={GraduationCap} label="Topshirilgan imtihonlar" value={s?.examsTotal ?? 0} loading={loading} delay={0.05} />
          <StatCard icon={Activity} label="O'rtacha natija" value={s?.avgExamScore ?? 0} suffix="%" loading={loading} delay={0.1} />
          <StatCard icon={TrendingUp} label="Imtihondan o'tish" value={s?.passRate ?? 0} suffix="%" loading={loading} delay={0.15} />
        </div>
      </div>
    </div>
  );
}
