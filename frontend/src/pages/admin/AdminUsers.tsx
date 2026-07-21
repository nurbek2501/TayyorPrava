import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AtSign, CalendarDays, Link2Off, Search, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorMessage, usersApi } from "@/lib/api";
import { useUsers } from "@/lib/queries";
import { cn, formatDate } from "@/lib/utils";
import { PageLoader } from "@/components/ui/Spinner";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmModal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import type { UserProfile } from "@/lib/types";

export function AdminUsers() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [unbindTarget, setUnbindTarget] = useState<UserProfile | null>(null);
  const { data, isLoading } = useUsers({ search: search || undefined, page });

  const blockM = useMutation({
    mutationFn: ({ id, isBlocked }: { id: string; isBlocked: boolean }) =>
      usersApi.update(id, { isBlocked }),
    onSuccess: () => {
      toast.success(t("common.save"));
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const unbindM = useMutation({
    mutationFn: (id: string) => usersApi.unbindTelegram(id),
    onSuccess: () => {
      toast.success(t("admin.userMgmt.unbindDone"));
      qc.invalidateQueries({ queryKey: ["users"] });
      setUnbindTarget(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const fullName = (u: UserProfile) =>
    [u.name, u.surname].filter(Boolean).join(" ") || t("admin.userMgmt.noName");

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.users")}</h1>
        {data && (
          <span className="chip bg-accent/15 text-accent">
            {t("admin.userMgmt.total", { count: data.total })}
          </span>
        )}
      </motion.div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="input pl-9"
          placeholder={t("admin.userMgmt.search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-2.5">
          {data?.items.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.4) }}
              className={cn(
                "glass-card glass-hover flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between",
                u.isBlocked && "opacity-70 ring-1 ring-danger/30"
              )}
            >
              {/* Chap: shaxs */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-sm font-bold uppercase text-white shadow-glow">
                    {(u.nickname || u.name || "?").slice(0, 2)}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                      u.isBlocked ? "bg-danger" : u.subscriptionActive ? "bg-success" : "bg-muted"
                    )}
                  />
                </div>
                <div className="min-w-0">
                  {u.nickname ? (
                    <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-accent/15 px-2 py-0.5 font-bold text-accent">
                      <AtSign className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{u.nickname}</span>
                    </span>
                  ) : (
                    <span className="font-bold text-ink">{fullName(u)}</span>
                  )}
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                    {u.nickname && <span className="truncate">{fullName(u)} · </span>}
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    {formatDate(u.createdAt)}
                  </div>
                </div>
              </div>

              {/* O'ng: holatlar + amallar */}
              <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
                {/* Obuna */}
                <span
                  className={cn(
                    "chip",
                    u.subscriptionActive
                      ? "bg-success/15 text-success"
                      : "bg-line/15 text-muted"
                  )}
                >
                  {t("admin.userMgmt.subscription")}:{" "}
                  {u.subscriptionActive ? t("common.active") : t("common.inactive")}
                </span>

                {/* Telegram */}
                {u.telegramId ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-400">
                    <Send className="h-3 w-3" />
                    {t("admin.userMgmt.bound")}
                    <button
                      onClick={() => setUnbindTarget(u)}
                      title={t("admin.userMgmt.unbind")}
                      className="ml-0.5 text-danger transition hover:scale-110"
                    >
                      <Link2Off className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <span className="chip bg-line/15 text-xs text-muted">
                    {t("admin.userMgmt.notBound")}
                  </span>
                )}

                {/* Avto-blok sababi (xavfsizlik tizimi belgilagan) */}
                {u.isBlocked && u.blockReason && (
                  <span
                    className="chip max-w-[12rem] truncate bg-danger/15 text-danger"
                    title={
                      u.blockReason +
                      (u.blockedAt ? " · " + formatDate(u.blockedAt) : "")
                    }
                  >
                    🛡 {u.blockReason}
                  </span>
                )}

                {/* Bloklash */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">
                    {u.isBlocked ? t("admin.userMgmt.blocked") : t("admin.userMgmt.block")}
                  </span>
                  <Toggle
                    checked={u.isBlocked}
                    onChange={(v) => blockM.mutate({ id: u.id, isBlocked: v })}
                  />
                </div>
              </div>
            </motion.div>
          ))}
          {!data?.items.length && (
            <div className="glass-card p-10 text-center text-muted">{t("common.empty")}</div>
          )}
        </div>
      )}

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

      <ConfirmModal
        open={!!unbindTarget}
        title={t("admin.userMgmt.unbind")}
        description={
          unbindTarget
            ? t("admin.userMgmt.unbindConfirm", { nick: unbindTarget.nickname ?? "" })
            : ""
        }
        danger
        confirmText={t("common.yes")}
        cancelText={t("common.no")}
        onConfirm={() => unbindTarget && unbindM.mutate(unbindTarget.id)}
        onCancel={() => setUnbindTarget(null)}
      />
    </div>
  );
}
