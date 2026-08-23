import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  CheckCircle2,
  Gift,
  Loader2,
  SkipForward,
  UserPlus,
  XCircle,
} from "lucide-react";
import { authApi, getErrorMessage } from "@/lib/api";
import {
  NICKNAME_RULES,
  isNicknameValid,
  isPasswordValid,
} from "@/lib/authValidation";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/Spinner";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { BackToHome } from "@/components/shared/BackToHome";
import { RequirementList } from "@/components/auth/RequirementList";
import { NewPasswordFields } from "@/components/auth/NewPasswordFields";
import { TelegramConfirm } from "@/components/auth/TelegramConfirm";
import { NicknameSavedModal } from "@/components/auth/NicknameSavedModal";

type NickStatus = "idle" | "checking" | "available" | "taken" | "invalid";
/** 1) nik+parol  2) promokod (o'tkazib yuborish mumkin)  3) bot orqali tasdiq */
type Step = "form" | "promo" | "confirm";

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setToken = useAuth((s) => s.setUserToken);
  const ref = params.get("ref") || undefined;

  const [step, setStep] = useState<Step>("form");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [nickStatus, setNickStatus] = useState<NickStatus>("idle");
  const [confirmData, setConfirmData] = useState<{
    nickname: string;
    botUsername: string;
    channel: string;
  } | null>(null);
  // Ro'yxat tugagach — nikni eslatish modali
  const [savedNick, setSavedNick] = useState<string | null>(null);
  // Promokod (taklif) — URL ?ref dan to'ldiriladi yoki qo'lda kiritiladi
  const [promo, setPromo] = useState(ref ?? "");
  const [promoStatus, setPromoStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [promoName, setPromoName] = useState("");

  // Nick band emasligini jonli tekshirish (debounce 500ms)
  useEffect(() => {
    if (!nickname) return setNickStatus("idle");
    if (!isNicknameValid(nickname)) return setNickStatus("invalid");
    setNickStatus("checking");
    const id = setTimeout(async () => {
      try {
        const res = await authApi.checkNickname(nickname);
        setNickStatus(res.available ? "available" : "taken");
      } catch {
        setNickStatus("idle");
      }
    }, 500);
    return () => clearTimeout(id);
  }, [nickname]);

  // Promokodni jonli tekshirish (debounce 500ms)
  useEffect(() => {
    if (!promo.trim()) {
      setPromoStatus("idle");
      return;
    }
    setPromoStatus("checking");
    const id = setTimeout(async () => {
      try {
        const res = await authApi.checkPromo(promo.trim());
        setPromoStatus(res.valid ? "valid" : "invalid");
        setPromoName(res.name ?? "");
      } catch {
        setPromoStatus("idle");
      }
    }, 500);
    return () => clearTimeout(id);
  }, [promo]);

  // Promokod bosqichidan keyin — pending saqlanadi va bot bosqichiga o'tamiz
  const mutation = useMutation({
    mutationFn: (usePromo: boolean) =>
      authApi.registerInit({
        nickname,
        password,
        ref: usePromo ? promo.trim() || undefined : undefined,
      }),
    onSuccess: (d) => {
      setConfirmData({
        nickname: d.nickname,
        botUsername: d.botUsername,
        channel: d.channel,
      });
      setStep("confirm");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const nickReady = isNicknameValid(nickname) && nickStatus === "available";
  const pwReady = isPasswordValid(password) && password === confirmPassword;
  const canContinue = nickReady && pwReady;

  return (
    <div className="flex min-h-screen flex-col p-4 sm:p-6">
      <div className="shrink-0">
        <BackToHome label={t("common.back")} />
      </div>
      <div className="flex flex-1 items-center justify-center py-4 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 16 }}
          className="glass-card w-full max-w-md p-6 sm:p-8"
        >
          {step === "confirm" && confirmData ? (
            <TelegramConfirm
              nickname={confirmData.nickname}
              botUsername={confirmData.botUsername}
              channel={confirmData.channel}
              verify={async (code) => {
                const d = await authApi.verifyCode({
                  nickname: confirmData.nickname,
                  code,
                });
                setToken(d.accessToken, d.refreshToken);
                // Darhol o'tkazmaymiz — avval nikni eslatamiz
                setSavedNick(confirmData.nickname);
              }}
              onBack={() => setStep("promo")}
            />
          ) : step === "promo" ? (
            <PromoStep
              promo={promo}
              onPromoChange={setPromo}
              status={promoStatus}
              inviterName={promoName}
              pending={mutation.isPending}
              onBack={() => setStep("form")}
              onContinue={() => mutation.mutate(true)}
              onSkip={() => mutation.mutate(false)}
            />
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <Logo />
                <LangSwitcher />
              </div>

              <h1 className="text-2xl font-bold text-ink">{t("auth.registerTitle")}</h1>
              <p className="mt-1 text-sm text-muted">{t("auth.registerSubtitle")}</p>

              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canContinue) setStep("promo");
                }}
              >
                {/* Nickname */}
                <div>
                  <Field
                    icon={<AtSign className="h-4 w-4" />}
                    label={t("auth.nickLabel")}
                    right={<NickIndicator status={nickStatus} />}
                  >
                    <input
                      className={cn(
                        "input pl-10 pr-10",
                        nickStatus === "taken" && "ring-1 ring-danger/60",
                        nickStatus === "available" && "ring-1 ring-success/60"
                      )}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value.trim())}
                      onFocus={() => setFocused("nick")}
                      onBlur={() => setFocused(null)}
                      placeholder={t("auth.nickExample")}
                      autoComplete="username"
                      required
                    />
                  </Field>
                  {(focused === "nick" || nickname) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="overflow-hidden"
                    >
                      <RequirementList rules={NICKNAME_RULES} value={nickname} />
                      {nickStatus === "taken" && (
                        <p className="mt-1.5 text-xs font-medium text-danger">
                          {t("auth.nickTaken")}
                        </p>
                      )}
                      {nickStatus === "available" && (
                        <p className="mt-1.5 text-xs font-medium text-success">
                          {t("auth.nickFree")}
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Parol + parolni takrorlash */}
                <NewPasswordFields
                  password={password}
                  onPasswordChange={setPassword}
                  confirm={confirmPassword}
                  onConfirmChange={setConfirmPassword}
                />

                <button
                  type="submit"
                  className="btn-primary mt-2 w-full"
                  disabled={!canContinue}
                >
                  <UserPlus className="h-4 w-4" />
                  {t("auth.continue")}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-muted">
                {t("auth.haveAccount")}{" "}
                <Link to="/login" className="font-semibold text-accent hover:underline">
                  {t("auth.signIn")}
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>

      {savedNick && (
        <NicknameSavedModal
          nickname={savedNick}
          onContinue={() => navigate("/dashboard")}
        />
      )}
    </div>
  );
}

/** 2-bosqich: taklif promokodi (ixtiyoriy — o'tkazib yuborish mumkin). */
function PromoStep({
  promo,
  onPromoChange,
  status,
  inviterName,
  pending,
  onBack,
  onContinue,
  onSkip,
}: {
  promo: string;
  onPromoChange: (v: string) => void;
  status: "idle" | "checking" | "valid" | "invalid";
  inviterName: string;
  pending: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const canContinue = !!promo.trim() && status === "valid" && !pending;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16 }}
    >
      <button onClick={onBack} className="btn-ghost mb-4 text-sm" disabled={pending}>
        <ArrowLeft className="h-4 w-4" />
        {t("auth.back")}
      </button>

      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow"
        >
          <Gift className="h-8 w-8" />
        </motion.div>
        <h1 className="text-xl font-bold text-ink">{t("auth.promoTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("auth.promoSubtitle")}</p>
      </div>

      <div className="mt-6">
        <Field
          icon={<Gift className="h-4 w-4" />}
          label={t("auth.enterPromo")}
          right={
            status === "checking" ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted" />
            ) : status === "valid" ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : status === "invalid" ? (
              <XCircle className="h-4 w-4 text-danger" />
            ) : null
          }
        >
          <input
            className={cn(
              "input pl-10 pr-10 uppercase tracking-wider",
              status === "valid" && "ring-1 ring-success/60",
              status === "invalid" && "ring-1 ring-danger/60"
            )}
            value={promo}
            onChange={(e) => onPromoChange(e.target.value.toUpperCase())}
            placeholder={t("auth.promoPlaceholder")}
            autoComplete="off"
            autoFocus
          />
        </Field>
        {status === "valid" && (
          <p className="mt-1.5 text-xs font-medium text-success">
            {t("auth.promoValid")}
            {inviterName ? ` · ${inviterName}` : ""}
          </p>
        )}
        {status === "invalid" && (
          <p className="mt-1.5 text-xs font-medium text-danger">
            {t("auth.promoInvalid")}
          </p>
        )}
      </div>

      <button
        onClick={onContinue}
        className="btn-primary mt-5 w-full"
        disabled={!canContinue}
      >
        {pending ? (
          <Spinner />
        ) : (
          <>
            {t("auth.continue")}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <button
        onClick={onSkip}
        disabled={pending}
        className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
      >
        <SkipForward className="h-4 w-4" />
        {t("auth.promoSkip")}
      </button>
    </motion.div>
  );
}

/** Ikonkali, o'ng tomonida status bo'lishi mumkin bo'lgan input qobig'i. */
function Field({
  icon,
  label,
  right,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          {icon}
        </span>
        {children}
        {right && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>
        )}
      </div>
    </div>
  );
}

function NickIndicator({ status }: { status: NickStatus }) {
  if (status === "checking")
    return <Loader2 className="h-4 w-4 animate-spin text-muted" />;
  if (status === "available")
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "taken" || status === "invalid")
    return <XCircle className="h-4 w-4 text-danger" />;
  return null;
}
