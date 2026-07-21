import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, AtSign, KeyRound, Lock, RotateCcw, Trash2 } from "lucide-react";
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

type Phase = "nickname" | "confirm" | "newpw" | "deleted";
type Purpose = "reset" | "delete";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setToken = useAuth((s) => s.setUserToken);
  const [phase, setPhase] = useState<Phase>("nickname");
  const [purpose, setPurpose] = useState<Purpose>("reset");
  const [nickname, setNickname] = useState("");
  const [bot, setBot] = useState<{ botUsername: string; channel: string } | null>(
    null
  );
  const [resetCode, setResetCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [nickFocused, setNickFocused] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // forgot-init avval nik bazada borligini tekshiradi (404 -> ogohlantirish).
  // Reset -> to'g'ridan tasdiq; Delete -> avval o'chirish modali.
  const initM = useMutation({
    mutationFn: (_p: Purpose) => authApi.forgotInit(nickname),
    onSuccess: (d, p) => {
      setBot({ botUsername: d.botUsername, channel: d.channel });
      setPurpose(p);
      if (p === "delete") setDeleteOpen(true);
      else setPhase("confirm");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const resetM = useMutation({
    mutationFn: () =>
      authApi.resetPassword({ nickname, code: resetCode, newPassword: password }),
    onSuccess: (d) => {
      setToken(d.accessToken, d.refreshToken);
      toast.success(t("auth.passwordUpdated"));
      navigate("/dashboard");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const pwReady = isPasswordValid(password) && password === confirmPw;
  const nickOk = isNicknameValid(nickname);
  const busyReset = initM.isPending && initM.variables === "reset";
  const busyDelete = initM.isPending && initM.variables === "delete";

  return (
    <div className="flex min-h-screen flex-col p-4 sm:p-6">
      <div className="shrink-0">
        <BackToHome label={t("auth.back")} />
      </div>
      <div className="flex flex-1 items-center justify-center py-4 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 16 }}
          className="glass-card w-full max-w-md p-6 sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <LangSwitcher />
          </div>

          {/* 1-bosqich: nik + 2 ta amal (tiklash / o'chirish) */}
          {phase === "nickname" && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <KeyRound className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-ink">
                    {t("auth.resetTitle")}
                  </h1>
                  <p className="text-sm text-muted">{t("auth.resetSubtitle")}</p>
                </div>
              </div>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (nickOk) initM.mutate("reset");
                }}
              >
                <div>
                  <label className="label">{t("auth.nickLabel")}</label>
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      className="input pl-10"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value.trim())}
                      onFocus={() => setNickFocused(true)}
                      onBlur={() => setNickFocused(false)}
                      placeholder={t("auth.nickReset")}
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted">{t("auth.nickExactHint")}</p>
                  {(nickFocused || nickname) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="overflow-hidden"
                    >
                      <RequirementList rules={NICKNAME_RULES} value={nickname} />
                    </motion.div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={!nickOk || initM.isPending}
                >
                  {busyReset ? (
                    <Spinner />
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      {t("auth.resetAction")}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (nickOk) initM.mutate("delete");
                  }}
                  disabled={!nickOk || initM.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-danger/30 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50"
                >
                  {busyDelete ? (
                    <Spinner />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      {t("auth.deleteAction")}
                    </>
                  )}
                </button>
              </form>
              <p className="mt-5 text-center text-sm text-muted">
                <Link
                  to="/login"
                  className="font-semibold text-accent hover:underline"
                >
                  {t("auth.backToLogin")}
                </Link>
              </p>
            </>
          )}

          {/* 2-bosqich: Telegram tasdiq (tiklash yoki o'chirish) */}
          {phase === "confirm" && bot && (
            <TelegramConfirm
              nickname={nickname}
              botUsername={bot.botUsername}
              channel={bot.channel}
              subtitle={
                purpose === "delete"
                  ? t("auth.deleteCodeSubtitle")
                  : t("auth.tgResetSubtitle")
              }
              verify={async (code) => {
                if (purpose === "delete") {
                  await authApi.deleteAccount({ nickname, code });
                  setPhase("deleted");
                } else {
                  await authApi.verifyReset({ nickname, code });
                  setResetCode(code);
                  setPhase("newpw");
                }
              }}
              onBack={() => setPhase("nickname")}
            />
          )}

          {/* 3-bosqich: yangi parol */}
          {phase === "newpw" && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-ink">
                    {t("auth.newPasswordTitle")}
                  </h1>
                  <p className="text-sm text-muted">
                    {t("auth.newPasswordSubtitle")}
                  </p>
                </div>
              </div>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pwReady) resetM.mutate();
                }}
              >
                <NewPasswordFields
                  label={t("auth.newPasswordTitle")}
                  password={password}
                  onPasswordChange={setPassword}
                  confirm={confirmPw}
                  onConfirmChange={setConfirmPw}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={!pwReady || resetM.isPending}
                >
                  {resetM.isPending ? <Spinner /> : t("auth.savePassword")}
                </button>
              </form>
            </>
          )}

          {/* Akkaunt o'chirildi */}
          {phase === "deleted" && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/15 text-danger">
                <Trash2 className="h-8 w-8" />
              </div>
              <h1 className="text-xl font-bold text-ink">{t("auth.deletedTitle")}</h1>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                {t("auth.deletedText")}
              </p>
              <button
                onClick={() => navigate("/")}
                className="btn-primary mt-6 w-full"
              >
                {t("auth.toHome")}
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Akkauntni o'chirish tasdiq modali */}
      {deleteOpen && (
        <div
          onClick={() => setDeleteOpen(false)}
          className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-zoom-in w-full max-w-sm rounded-3xl border border-line/15 bg-card p-7 text-center shadow-glass"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/15 text-danger">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-ink">
              {t("auth.deleteConfirmTitle")}
            </h2>
            <p className="mx-auto mt-2 text-sm text-muted">
              {t("auth.deleteConfirmText")}
            </p>
            <div className="mt-3 rounded-xl bg-danger/10 py-2 text-sm font-bold text-danger">
              {nickname}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteOpen(false)}
                className="btn-ghost flex-1 justify-center"
              >
                {t("auth.cancel")}
              </button>
              <button
                onClick={() => {
                  setDeleteOpen(false);
                  setPhase("confirm");
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-2xl bg-danger py-2.5 font-semibold text-white transition hover:bg-danger/90"
                )}
              >
                <Trash2 className="h-4 w-4" />
                {t("auth.deleteConfirmYes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
