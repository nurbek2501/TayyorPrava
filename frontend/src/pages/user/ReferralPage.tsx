import { Copy, Gift, UserCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/shared/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { useReferral } from "@/lib/queries";
import { toast } from "@/components/ui/toast";

export function ReferralPage() {
  const { t } = useTranslation();
  const { data } = useReferral();

  const copy = async () => {
    if (!data?.refLink) return;
    try {
      await navigator.clipboard.writeText(data.refLink);
      toast.success(t("common.copied"));
    } catch {
      toast.error("Nusxalashda xatolik");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">{t("referral.title")}</h1>
        <p className="mt-1 text-muted">{t("referral.desc")}</p>
      </div>

      <GlassCard>
        <label className="label">{t("referral.yourLink")}</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="input flex-1" readOnly value={data?.refLink ?? ""} />
          <button onClick={copy} className="btn-primary">
            <Copy className="h-4 w-4" />
            {t("common.copy")}
          </button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Gift} label={t("referral.bonus")} value={data?.bonus ?? 0} suffix=" so'm" />
        <StatCard icon={Users} label={t("referral.invited")} value={data?.invited ?? 0} />
        <StatCard icon={UserCheck} label={t("referral.paid")} value={data?.paid ?? 0} />
      </div>

      {(data?.invited ?? 0) === 0 && (
        <GlassCard className="text-center text-muted">{t("referral.empty")}</GlassCard>
      )}
    </div>
  );
}
