import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Copy,
  Gift,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/shared/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useReferral } from "@/lib/queries";
import { getErrorMessage, meApi } from "@/lib/api";
import { qk } from "@/lib/queries";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const nf = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

export function ReferralPage() {
  const { t } = useTranslation();
  const { data } = useReferral();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Sotib olingan yangi kod — modalda ko'rsatiladi (foydalanuvchi ko'chirib olsin)
  const [newCode, setNewCode] = useState<string | null>(null);

  const bonus = data?.bonus ?? 0;
  const price = data?.promoPrice ?? 0;
  const canBuy = price > 0 && bonus >= price;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("common.copied"));
    } catch {
      toast.error("Nusxalashda xatolik");
    }
  };

  const buy = useMutation({
    mutationFn: meApi.buyPromo,
    onSuccess: (res) => {
      setConfirmOpen(false);
      setNewCode(res.code);
      qc.invalidateQueries({ queryKey: qk.referral });
    },
    onError: (e) => {
      setConfirmOpen(false);
      toast.error(getErrorMessage(e));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">{t("referral.title")}</h1>
        <p className="mt-1 text-muted">{t("referral.desc")}</p>
      </div>

      {/* Taklif havolasi */}
      <GlassCard>
        <label className="label">{t("referral.yourLink")}</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="input flex-1" readOnly value={data?.refLink ?? ""} />
          <button onClick={() => copy(data?.refLink ?? "")} className="btn-primary">
            <Copy className="h-4 w-4" />
            {t("common.copy")}
          </button>
        </div>
      </GlassCard>

      {/* Bonus — yetarli bo'lsa bosiladi va promokodga almashtiriladi */}
      <GlassCard
        className={cn(
          "transition",
          canBuy && "cursor-pointer border-accent/50 shadow-glow hover:-translate-y-0.5"
        )}
        onClick={canBuy ? () => setConfirmOpen(true) : undefined}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow">
            <Gift className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-muted">{t("referral.bonus")}</div>
            <div className="text-2xl font-extrabold text-ink">{nf(bonus)} so'm</div>
            <p className="mt-1 text-xs text-muted">
              {canBuy
                ? t("referral.canBuyHint")
                : t("referral.needMore", { amount: nf(Math.max(0, price - bonus)) })}
            </p>
          </div>
          <button
            disabled={!canBuy}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmOpen(true);
            }}
            className="btn-primary shrink-0 disabled:opacity-50"
          >
            <Ticket className="h-4 w-4" />
            {t("referral.buyPromo")}
          </button>
        </div>
      </GlassCard>

      {/* Sotib olingan kodlar */}
      {(data?.myPromoCodes?.length ?? 0) > 0 && (
        <GlassCard>
          <div className="mb-3 font-bold text-ink">{t("referral.myCodes")}</div>
          <div className="space-y-2">
            {data!.myPromoCodes.map((c) => (
              <div
                key={c.code}
                className="flex items-center gap-3 rounded-xl bg-card/50 p-3"
              >
                <code
                  className={cn(
                    "flex-1 font-mono text-lg font-bold tracking-wider",
                    c.used ? "text-muted line-through" : "text-accent"
                  )}
                >
                  {c.code}
                </code>
                {c.used ? (
                  <span className="chip bg-muted/20 text-muted">
                    {t("referral.codeUsed")}
                  </span>
                ) : (
                  <>
                    <span className="chip bg-success/20 text-success">
                      {t("referral.codeActive")}
                    </span>
                    <button
                      onClick={() => copy(c.code)}
                      className="btn-ghost p-2"
                      aria-label={t("common.copy")}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Gift} label={t("referral.bonus")} value={bonus} suffix=" so'm" />
        <StatCard icon={Users} label={t("referral.invited")} value={data?.invited ?? 0} />
        <StatCard icon={UserCheck} label={t("referral.paid")} value={data?.paid ?? 0} />
      </div>

      {(data?.invited ?? 0) === 0 && (
        <GlassCard className="text-center text-muted">{t("referral.empty")}</GlassCard>
      )}

      {/* Ogohlantirish modali — sotib olishdan oldin */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} className="max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-ink">
            {t("referral.confirmTitle")}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {t("referral.confirmText", { price: nf(price) })}
          </p>
          <ul className="mt-4 w-full space-y-2 rounded-xl bg-card/50 p-4 text-left text-sm text-muted">
            <li>• {t("referral.rule1")}</li>
            <li>• {t("referral.rule2")}</li>
            <li>• {t("referral.rule3")}</li>
          </ul>
          <div className="mt-6 flex w-full gap-3">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={buy.isPending}
              className="btn-ghost flex-1"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => buy.mutate()}
              disabled={buy.isPending}
              className="btn-primary flex-1"
            >
              {buy.isPending ? <Spinner /> : <Check className="h-4 w-4" />}
              {t("referral.confirmYes")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Yangi kod — sotib olingandan keyin */}
      <Modal open={!!newCode} onClose={() => setNewCode(null)} className="max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
            <Ticket className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-ink">{t("referral.boughtTitle")}</h3>
          <p className="mt-2 text-sm text-muted">{t("referral.boughtText")}</p>
          <button
            onClick={() => copy(newCode ?? "")}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent/10 py-4 font-mono text-2xl font-extrabold tracking-widest text-accent transition hover:bg-accent/20"
          >
            {newCode}
            <Copy className="h-5 w-5" />
          </button>
          <p className="mt-2 text-xs text-muted">{t("referral.copyHint")}</p>
          <button onClick={() => setNewCode(null)} className="btn-primary mt-6 w-full">
            {t("common.ok")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
