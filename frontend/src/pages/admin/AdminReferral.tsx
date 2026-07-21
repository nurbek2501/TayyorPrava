import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Gift,
  Loader2,
  Percent,
  Plus,
  Tag,
  Ticket,
  Trash2,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorMessage, promoCodesApi, settingsApi } from "@/lib/api";
import type { PromoCode } from "@/lib/api";
import { useAdminReferral, useSettings } from "@/lib/queries";
import { PageLoader, Skeleton, Spinner } from "@/components/ui/Spinner";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmModal } from "@/components/ui/Modal";
import { cn, formatNumber } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

function StatBox({
  icon: Icon,
  label,
  value,
  suffix = "",
  gradient,
  delay,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
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
      <div className="mt-3 text-2xl font-extrabold tabular-nums sm:text-3xl">
        {formatNumber(value)}
        {suffix}
      </div>
      <div className="mt-0.5 text-sm font-medium text-white/85">{label}</div>
    </motion.div>
  );
}

/**
 * Chegirma promokodlari — yuqoridagi "Promokod bonusi" (do'stni taklif qilish)dan
 * MUSTAQIL yangi funksiya: admin kod yaratadi, real imtihon narxiga foizli chegirma
 * beradi (masalan "SUMMER30" -> 30% chegirma). User RealExamPage to'lov modalida kiritadi.
 */
function DiscountPromoSection() {
  const qc = useQueryClient();
  const { data: promos, isLoading } = useQuery({
    queryKey: ["adminPromoCodes"],
    queryFn: promoCodesApi.adminList,
  });
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState(10);
  const [deleting, setDeleting] = useState<PromoCode | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["adminPromoCodes"] });

  const createMut = useMutation({
    mutationFn: () =>
      promoCodesApi.create({ code: code.trim(), discountPercent: discount }),
    onSuccess: () => {
      toast.success("Promokod yaratildi");
      setCode("");
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const toggleMut = useMutation({
    mutationFn: (p: PromoCode) =>
      promoCodesApi.update(p.id, { isActive: !p.isActive }),
    onSuccess: invalidate,
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => promoCodesApi.remove(id),
    onSuccess: () => {
      toast.success("Promokod o'chirildi");
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      className="overflow-hidden rounded-3xl border border-line/15 bg-card/70 shadow-glass backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 border-b border-line/10 bg-accent/10 px-5 py-3.5">
        <Tag className="h-5 w-5 text-accent" />
        <h3 className="font-bold text-ink">Chegirma promokodlari</h3>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-xs text-muted">
          Real imtihon narxiga foizli chegirma beruvchi kodlar — bu yerda yaratasiz,
          user to'lov oynasida kiritadi.
        </p>

        {/* Yangi promokod yaratish */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1 font-mono uppercase tracking-wider"
            placeholder="SUMMER30"
            maxLength={32}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <div className="flex items-center gap-2">
            <div className="relative w-24 shrink-0">
              <input
                type="number"
                min={1}
                max={100}
                className="input pr-7 text-center font-bold"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
              <Percent className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
            <button
              onClick={() => createMut.mutate()}
              disabled={
                createMut.isPending ||
                code.trim().length < 4 ||
                discount < 1 ||
                discount > 100
              }
              className="btn-primary shrink-0"
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Yaratish
            </button>
          </div>
        </div>

        {/* Ro'yxat */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !promos?.length ? (
          <p className="py-6 text-center text-sm text-muted">
            Hozircha chegirma promokodi yo'q.
          </p>
        ) : (
          <div className="space-y-2">
            {promos.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-line/10 bg-bg2/40 p-3",
                  !p.isActive && "opacity-50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold tracking-wider text-ink">
                      {p.code}
                    </span>
                    <span className="chip bg-accent/15 text-accent">
                      {p.discountPercent}%
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {p.usedCount} marta ishlatilgan
                  </div>
                </div>
                <Toggle
                  checked={p.isActive}
                  onChange={() => toggleMut.mutate(p)}
                  disabled={toggleMut.isPending}
                />
                <button
                  onClick={() => setDeleting(p)}
                  className="btn-ghost h-9 w-9 shrink-0 rounded-full p-0 text-danger"
                  aria-label="O'chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleting}
        danger
        title={`"${deleting?.code}" promokodini o'chirasizmi?`}
        confirmText="Ha, o'chirish"
        cancelText="Bekor qilish"
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </motion.div>
  );
}

export function AdminReferral() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const referral = useAdminReferral();
  const settings = useSettings();
  const [bonus, setBonus] = useState(0);

  useEffect(() => {
    if (settings.data) setBonus(settings.data.referralBonus);
  }, [settings.data]);

  const mutation = useMutation({
    mutationFn: () => settingsApi.update({ referralBonus: bonus }),
    onSuccess: () => {
      toast.success(t("common.save"));
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["adminReferral"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (referral.isLoading || settings.isLoading) return <PageLoader />;
  const r = referral.data;

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-glow">
          <Ticket className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Promokod dasturi</h1>
          <p className="text-sm text-muted">
            Har bir foydalanuvchining shaxsiy promokodi bor — do'stini taklif qilib,
            u to'lov qilganda egasiga bonus beriladi.
          </p>
        </div>
      </motion.div>

      {/* Statistika — gradientli kartalar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatBox
          icon={Users}
          label="Promokod ishlatganlar"
          value={r?.totalInvited ?? 0}
          gradient="bg-gradient-to-br from-blue-600 to-indigo-800"
          delay={0}
        />
        <StatBox
          icon={UserCheck}
          label="To'lov qilganlar"
          value={r?.totalPaid ?? 0}
          gradient="bg-gradient-to-br from-emerald-500 to-green-700"
          delay={0.08}
        />
        <StatBox
          icon={Gift}
          label="Jami berilgan bonus (so'm)"
          value={r?.totalBonus ?? 0}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          delay={0.16}
        />
      </div>

      {/* Bonus sozlamasi */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-md overflow-hidden rounded-3xl border border-line/15 bg-card/70 shadow-glass backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 border-b border-line/10 bg-amber-400/10 px-5 py-3.5">
          <Wallet className="h-5 w-5 text-amber-500" />
          <h3 className="font-bold text-ink">Promokod bonusi</h3>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-xs text-muted">
            Promokod orqali kelgan do'st to'lov qilganda — egasiga shu summa beriladi.
          </p>
          <div>
            <label className="label">Bonus miqdori (so'm)</label>
            <input
              type="number"
              min={0}
              step={1000}
              className="input text-lg font-bold"
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value))}
            />
            <div className="mt-1.5 text-xs text-muted">
              Joriy:{" "}
              <b className="text-ink">{formatNumber(bonus)} so'm</b> har bir do'st uchun
            </div>
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary w-full"
          >
            {mutation.isPending ? <Spinner /> : t("common.save")}
          </button>
        </div>
      </motion.div>

      {/* Chegirma promokodlari — real imtihon narxiga (mustaqil yangi funksiya) */}
      <DiscountPromoSection />
    </div>
  );
}
