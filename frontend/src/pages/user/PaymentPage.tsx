import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Info, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getErrorMessage, paymentsApi } from "@/lib/api";
import { useActiveTariffs, useEnabledMethods } from "@/lib/queries";
import { cn, formatSom } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { Skeleton, Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";

export function PaymentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const { data: tariffs, isLoading: tariffsLoading } = useActiveTariffs();
  const { data: methods, isLoading: methodsLoading } = useEnabledMethods();

  const [tariffId, setTariffId] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? "");

  const selectedTariff = tariffs?.find((x) => x.id === tariffId);

  const mutation = useMutation({
    mutationFn: () =>
      paymentsApi.create({ tariffId: tariffId!, phone, method: method! }),
    onSuccess: () => toast.success(t("payment.success")),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const canPay = tariffId && method && phone.trim().length >= 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </button>
        <h1 className="text-xl font-bold text-ink">{t("payment.title")}</h1>
        <button className="btn-ghost">
          <Info className="h-4 w-4" />
          {t("payment.fullInfo")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: tariffs */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-bold text-ink">{t("payment.selectAmount")}</h2>
          <label className="label">{t("auth.phone")}</label>
          <input
            className="input mb-4"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
          />

          {tariffsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {tariffs?.map((tariff) => (
                <button
                  key={tariff.id}
                  onClick={() => setTariffId(tariff.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                    tariffId === tariff.id
                      ? "border-accent bg-accent/10"
                      : "border-line/15 bg-bg2/50 hover:border-accent/40"
                  )}
                >
                  <div>
                    <div className="font-semibold text-ink">{tariff.title}</div>
                    <div className="text-xs text-muted">
                      {tariff.durationDays} {t("payment.days")}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-accent">{formatSom(tariff.price)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: amount + methods */}
        <div className="glass-card p-5">
          <div className="mb-5 rounded-xl bg-gradient-to-br from-accent/20 to-accent-dark/10 p-5 text-center">
            <div className="text-sm text-muted">{t("payment.title")}</div>
            <motion.div
              key={selectedTariff?.price ?? 0}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-1 text-3xl font-extrabold text-accent"
            >
              {formatSom(selectedTariff?.price ?? 0)}
            </motion.div>
            {!selectedTariff && (
              <p className="mt-2 text-xs text-warning">{t("payment.selectTariffFirst")}</p>
            )}
          </div>

          <h2 className="mb-3 font-bold text-ink">{t("payment.methods")}</h2>
          {methodsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {methods?.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.code)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3 transition",
                    method === m.code
                      ? "border-accent bg-accent/10"
                      : "border-line/15 bg-bg2/50 hover:border-accent/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-ink">{m.name}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => mutation.mutate()}
            disabled={!canPay || mutation.isPending}
            className="btn-primary mt-5 w-full"
          >
            {mutation.isPending ? <Spinner /> : t("payment.pay")}
          </button>
        </div>
      </div>
    </div>
  );
}
