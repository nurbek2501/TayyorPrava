import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Copy,
  Gift,
  KeyRound,
  Loader2,
  ShieldAlert,
  Upload,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { assetUrl, authApi, getErrorMessage, realExamApi } from "@/lib/api";
import { isPasswordValid } from "@/lib/authValidation";
import { useAuth } from "@/store/auth";
import { useReferral } from "@/lib/queries";
import { GlassCard } from "@/components/ui/GlassCard";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";
import { NewPasswordFields } from "@/components/auth/NewPasswordFields";
import { cn, formatNumber, initials } from "@/lib/utils";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: ref } = useReferral();

  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    telegram: "",
    avatarUrl: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        surname: user.surname ?? "",
        email: user.email ?? "",
        telegram: user.telegram ?? "",
        avatarUrl: user.avatarUrl ?? "",
      });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () => authApi.updateMe(form),
    onSuccess: (data) => {
      setUser(data);
      toast.success(t("profile.saved"));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // ---- Parolni o'zgartirish ----
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const changePw = useMutation({
    mutationFn: () =>
      authApi.changePassword({ oldPassword: oldPw, newPassword: newPw }),
    onSuccess: () => {
      toast.success(t("auth.passwordChanged"));
      setOldPw("");
      setNewPw("");
      setConfPw("");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const pwReady =
    !!oldPw && isPasswordValid(newPw) && newPw === confPw && !changePw.isPending;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, avatarUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const avatarSrc = form.avatarUrl.startsWith("data:")
    ? form.avatarUrl
    : assetUrl(form.avatarUrl);

  // ---- Bonus bilan real imtihon sotib olish ----
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [examPrice, setExamPrice] = useState(0);
  useEffect(() => {
    realExamApi
      .info()
      .then((d) => setExamPrice(d.price))
      .catch(() => {});
  }, [ref?.bonus]);

  const [bonusModal, setBonusModal] = useState<null | "buy" | "low">(null);
  const bonus = ref?.bonus ?? 0;
  const canBuy = examPrice > 0 && bonus >= examPrice;

  const buyBonus = useMutation({
    mutationFn: () => realExamApi.purchase("bonus"),
    onSuccess: () => {
      toast.success(t("referral.bonusBought"));
      setBonusModal(null);
      qc.invalidateQueries({ queryKey: ["referral"] });
      navigate("/real-exam");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleBonusClick = () => setBonusModal(canBuy ? "buy" : "low");

  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const copy = async (text: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Nusxalashda xatolik");
    }
  };

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-extrabold text-ink"
      >
        {t("profile.title")}
      </motion.h1>

      {/* Profil karta */}
      <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
        <GlassCard>
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative"
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-28 w-28 rounded-full object-cover ring-4 ring-accent/20"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-4xl font-bold text-white shadow-glow">
                  {initials(user?.name)}
                </div>
              )}
              <span
                className={cn(
                  "absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-2 border-card",
                  user?.subscriptionActive ? "bg-success" : "bg-muted"
                )}
              />
            </motion.div>
            <div className="flex-1 text-center sm:text-left">
              <div className="text-xl font-bold text-ink">
                {[user?.name, user?.surname].filter(Boolean).join(" ") ||
                  "Foydalanuvchi"}
              </div>
              <p className="mt-1 text-sm text-muted">{t("profile.photoHint")}</p>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <button onClick={() => fileRef.current?.click()} className="btn-ghost">
                  <Upload className="h-4 w-4" />
                  {t("profile.uploadPhoto")}
                </button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="btn-primary"
                >
                  {mutation.isPending ? <Spinner /> : <Check className="h-4 w-4" />}
                  {t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Parolni o'zgartirish */}
      <motion.div {...fadeUp} transition={{ duration: 0.45, delay: 0.05 }}>
        <GlassCard>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-extrabold text-ink">
              {t("auth.changePassword")}
            </h2>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pwReady) changePw.mutate();
            }}
          >
            <div>
              <label className="label">{t("auth.oldPassword")}</label>
              <input
                className="input"
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <NewPasswordFields
              label={t("auth.password")}
              password={newPw}
              onPasswordChange={setNewPw}
              confirm={confPw}
              onConfirmChange={setConfPw}
            />
            <button type="submit" className="btn-primary" disabled={!pwReady}>
              {changePw.isPending ? <Spinner /> : t("auth.changePassword")}
            </button>
          </form>
        </GlassCard>
      </motion.div>

      {/* Promokod */}
      <motion.div {...fadeUp} transition={{ duration: 0.45, delay: 0.1 }} className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-glow">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-ink">{t("auth.promoCode")}</h2>
            <p className="text-sm text-muted">{t("auth.promoShareHint")}</p>
          </div>
        </div>

        <GlassCard>
          <label className="label">{t("auth.yourPromo")}</label>
          <button
            onClick={() => ref?.refCode && copy(ref.refCode, "code")}
            title={t("common.copy")}
            className="group relative mt-1 flex w-full flex-col items-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-amber-400/50 bg-gradient-to-br from-amber-400/15 to-orange-500/5 py-7 transition hover:border-amber-400 hover:from-amber-400/25"
          >
            <span
              className="pointer-events-none absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-700 group-hover:translate-x-[220%]"
              style={{ clipPath: "polygon(20% 0, 40% 0, 18% 100%, 0% 100%)" }}
            />
            <span className="text-3xl font-extrabold tracking-[0.3em] text-ink sm:text-4xl">
              {ref?.refCode || "—"}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-600">
              {copied === "code" ? (
                <>
                  <Check className="h-4 w-4" /> {t("auth.copied")}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> {t("common.copy")}
                </>
              )}
            </span>
          </button>
        </GlassCard>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Bonus — bosib real imtihon sotib olish mumkin */}
          <button
            onClick={handleBonusClick}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-5 text-left text-white shadow-glow ring-1 ring-white/10 transition hover:-translate-y-0.5"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
            <Gift className="h-6 w-6" />
            <div className="mt-3 text-3xl font-extrabold tabular-nums">
              {formatNumber(bonus)}{" "}
              <span className="text-base font-bold text-white/80">so'm</span>
            </div>
            <div className="text-sm font-medium text-white/85">{t("referral.bonus")}</div>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              {t("referral.useBonus")}
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>

          {/* Chaqirilganlar */}
          <div className="rounded-3xl border border-line/15 bg-card/70 p-5 shadow-glass backdrop-blur-xl">
            <Users className="h-6 w-6 text-accent" />
            <div className="mt-3 text-3xl font-extrabold tabular-nums text-ink">
              {ref?.invited ?? 0}
            </div>
            <div className="text-sm font-medium text-muted">{t("referral.invited")}</div>
          </div>
        </div>
      </motion.div>

      {/* Bonus modali — sotib olish yoki ogohlantirish (animatsiyali, ideal) */}
      {bonusModal && (
        <div
          onClick={() => !buyBonus.isPending && setBonusModal(null)}
          className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-zoom-in w-full max-w-sm rounded-3xl border border-line/15 bg-card p-7 text-center shadow-glass"
          >
            <div
              className={cn(
                "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-glow ring-1 ring-white/10",
                bonusModal === "buy"
                  ? "bg-gradient-to-br from-amber-400 to-orange-500"
                  : "bg-gradient-to-br from-amber-500 to-red-500"
              )}
            >
              {bonusModal === "buy" ? (
                <Gift className="h-8 w-8" />
              ) : (
                <ShieldAlert className="h-8 w-8" />
              )}
            </div>

            <h2 className="text-xl font-bold text-ink">
              {bonusModal === "buy"
                ? t("referral.bonusBuyTitle")
                : t("referral.bonusInsufTitle")}
            </h2>

            {bonusModal === "buy" ? (
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                {t("referral.bonusBuyDesc", { price: formatNumber(examPrice) })}
              </p>
            ) : (
              <>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                  {t("referral.bonusOnlyReal")}
                </p>
                {examPrice > 0 && (
                  <div className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-600">
                    {t("referral.bonusNeed", {
                      price: formatNumber(examPrice),
                      bonus: formatNumber(bonus),
                    })}
                  </div>
                )}
              </>
            )}

            <div className="mt-6 space-y-2">
              {bonusModal === "buy" ? (
                <>
                  <button
                    onClick={() => buyBonus.mutate()}
                    disabled={buyBonus.isPending}
                    className="btn-primary w-full py-3 text-base shadow-glow"
                  >
                    {buyBonus.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Gift className="h-5 w-5" />
                    )}
                    {t("referral.bonusBuyConfirm")}
                  </button>
                  <button
                    onClick={() => setBonusModal(null)}
                    disabled={buyBonus.isPending}
                    className="w-full py-2 text-sm text-muted transition hover:text-ink"
                  >
                    {t("common.cancel")}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setBonusModal(null)}
                  className="btn-primary w-full py-3 text-base"
                >
                  {t("common.ok")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
