import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AtSign, CreditCard, DollarSign, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorMessage, paymentsApi } from "@/lib/api";
import { useDashboardSummary, usePayments } from "@/lib/queries";
import { cn, formatDateTime, formatNumber, formatSom } from "@/lib/utils";
import { PageLoader } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  failed: "bg-danger/15 text-danger",
  cancelled: "bg-line/15 text-muted",
};
const STATUSES = ["pending", "paid", "failed", "cancelled"];

function SummaryCard({
  icon: Icon,
  label,
  value,
  gradient,
  delay,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  gradient: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16, delay }}
      className={cn(
        "relative overflow-hidden rounded-3xl p-5 text-white shadow-glow ring-1 ring-white/10",
        gradient
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
      <Icon className="h-6 w-6" />
      <div className="mt-3 text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</div>
      <div className="mt-0.5 text-sm font-medium text-white/85">{label}</div>
    </motion.div>
  );
}

export function AdminPayments() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePayments(page);
  const summary = useDashboardSummary();

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      paymentsApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success(t("common.save"));
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashSummary"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const s = summary.data;

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-ink">{t("admin.payments")}</h1>

      {/* Summary — backenddan aniq jami ko'rsatkichlar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={DollarSign}
          label="Jami daromad (so'm)"
          value={formatNumber(s?.totalRevenue ?? 0)}
          gradient="bg-gradient-to-br from-emerald-500 to-green-700"
          delay={0}
        />
        <SummaryCard
          icon={CreditCard}
          label="Real imtihon daromadi"
          value={formatNumber(s?.realExamRevenue ?? 0)}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          delay={0.08}
        />
        <SummaryCard
          icon={Wallet}
          label="Jami to'lovlar soni"
          value={formatNumber(data?.total ?? 0)}
          gradient="bg-gradient-to-br from-blue-600 to-indigo-800"
          delay={0.16}
        />
      </div>

      {/* To'lovlar ro'yxati — nick + summa aniq */}
      <div className="space-y-2.5">
        {data?.items.map((p, i) => {
          const nick = p.userNickname;
          const type = p.tariffTitle ?? "Real imtihon to'lovi";
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.4) }}
              className="glass-card glass-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Chap: kim to'lagani — NICK aniq ko'rinadi */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-sm font-bold uppercase text-white shadow-glow">
                  {(nick || p.userName || "?").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  {nick ? (
                    <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-accent/15 px-2 py-0.5 font-bold text-accent">
                      <AtSign className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{nick}</span>
                    </span>
                  ) : (
                    <span className="font-bold text-ink">{p.userName || "Noma'lum"}</span>
                  )}
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {nick && p.userName ? `${p.userName} · ` : ""}
                    {type}
                  </div>
                </div>
              </div>

              {/* O'ng: qancha + usul + sana + status */}
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-right">
                  <div className="text-lg font-extrabold tabular-nums text-ink">
                    {formatSom(p.amount)}
                  </div>
                  <div className="text-xs text-muted">
                    <span className="capitalize">{p.method || "—"}</span> ·{" "}
                    {formatDateTime(p.createdAt)}
                  </div>
                </div>
                <select
                  value={p.status}
                  onChange={(e) => mutation.mutate({ id: p.id, status: e.target.value })}
                  className={cn(
                    "shrink-0 rounded-lg border-0 px-2.5 py-1.5 text-xs font-semibold outline-none ring-1 ring-line/10 transition",
                    STATUS_STYLES[p.status]
                  )}
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st} className="bg-bg2 text-ink">
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          );
        })}
        {!data?.items.length && (
          <div className="glass-card p-10 text-center text-muted">{t("common.empty")}</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost">
            {t("common.prev")}
          </button>
          <span className="text-sm text-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost"
          >
            {t("common.next")}
          </button>
        </div>
      )}
    </div>
  );
}
