import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AtSign,
  CheckCircle2,
  Gift,
  Loader2,
  User,
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

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setToken = useAuth((s) => s.setUserToken);
  const ref = params.get("ref") || undefined;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [nickStatus, setNickStatus] = useState<NickStatus>("idle");
  // Forma muvaffaqiyatli yuborilgach — Telegram tasdiq bosqichiga o'tamiz
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

  const mutation = useMutation({
    mutationFn: () =>
      authApi.registerInit({
        firstName,
        lastName,
        nickname,
        password,
        ref: promo.trim() || undefined,
      }),
    onSuccess: (d) =>
      setConfirmData({
        nickname: d.nickname,
        botUsername: d.botUsername,
        channel: d.channel,
      }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const nickReady = isNicknameValid(nickname) && nickStatus === "available";
  const pwReady = isPasswordValid(password) && password === confirmPassword;
  const canSubmit =
    !!firstName.trim() &&
    !!lastName.trim() &&
    nickReady &&
    pwReady &&
    promoStatus !== "invalid" &&
    promoStatus !== "checking" &&
    !mutation.isPending;

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
          {confirmData ? (
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
              onBack={() => setConfirmData(null)}
            />
          ) : (
            <>
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <LangSwitcher />
          </div>

          <h1 className="text-2xl font-bold text-ink">{t("auth.registerTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{t("auth.registerSubtitle")}</p>
          {ref && (
            <p className="mt-1 text-sm text-accent">
              {t("auth.refCode")} {ref}
            </p>
          )}

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) mutation.mutate();
            }}
          >
            {/* Ism + Familiya */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field icon={<User className="h-4 w-4" />} label={t("auth.firstName")}>
                <input
                  className="input pl-10"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("auth.firstNamePh")}
                  autoComplete="given-name"
                  required
                />
              </Field>
              <Field icon={<User className="h-4 w-4" />} label={t("auth.lastName")}>
                <input
                  className="input pl-10"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("auth.lastNamePh")}
                  autoComplete="family-name"
                  required
                />
              </Field>
            </div>

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

            {/* Promokod (ixtiyoriy) */}
            <div>
              <Field
                icon={<Gift className="h-4 w-4" />}
                label={t("auth.enterPromo")}
                right={
                  promoStatus === "checking" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  ) : promoStatus === "valid" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : promoStatus === "invalid" ? (
                    <XCircle className="h-4 w-4 text-danger" />
                  ) : null
                }
              >
                <input
                  className={cn(
                    "input pl-10 pr-10 uppercase tracking-wider",
                    promoStatus === "valid" && "ring-1 ring-success/60",
                    promoStatus === "invalid" && "ring-1 ring-danger/60"
                  )}
                  value={promo}
                  onChange={(e) => setPromo(e.target.value.toUpperCase())}
                  placeholder={t("auth.promoPlaceholder")}
                  autoComplete="off"
                />
              </Field>
              {promoStatus === "valid" && (
                <p className="mt-1.5 text-xs font-medium text-success">
                  {t("auth.promoValid")}
                  {promoName ? ` · ${promoName}` : ""}
                </p>
              )}
              {promoStatus === "invalid" && (
                <p className="mt-1.5 text-xs font-medium text-danger">
                  {t("auth.promoInvalid")}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary mt-2 w-full"
              disabled={!canSubmit}
            >
              {mutation.isPending ? (
                <Spinner />
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {t("auth.continue")}
                </>
              )}
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
