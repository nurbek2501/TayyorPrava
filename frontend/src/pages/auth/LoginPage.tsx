import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn, ShieldCheck, User } from "lucide-react";
import { authApi, getErrorMessage } from "@/lib/api";
import {
  clearAuthHash,
  readAuthResultFromHash,
  redirectToTelegram,
  type TelegramAuthUser,
} from "@/lib/telegramOAuth";
import { useAuth } from "@/store/auth";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/Spinner";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { BackToHome } from "@/components/shared/BackToHome";
import { TelegramLoginButton } from "@/components/auth/TelegramLoginButton";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setToken = useAuth((s) => s.setUserToken);
  const setAdminToken = useAuth((s) => s.setAdminToken);
  const [params] = useSearchParams();
  const ref = params.get("ref") || undefined;

  // Admin login+parol bilan kiradi — Telegram oqimiga aloqasi yo'q, shuning
  // uchun alohida (yig'iladigan) mini-forma sifatida saqlanadi.
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminLogin, setAdminLogin] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Xavfsizlik tizimi akkauntdan chiqarib yuborgan bo'lsa — sababini ko'rsatamiz
  useEffect(() => {
    const msg = sessionStorage.getItem("pp_block_msg");
    if (msg) {
      toast.error(msg);
      sessionStorage.removeItem("pp_block_msg");
    }
  }, []);

  const configQ = useQuery({
    queryKey: ["telegramConfig"],
    queryFn: authApi.telegramConfig,
    staleTime: 5 * 60_000,
  });

  const telegramMutation = useMutation({
    mutationFn: (u: TelegramAuthUser) =>
      authApi.telegramLogin({
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        username: u.username,
        photoUrl: u.photo_url,
        authDate: u.auth_date,
        hash: u.hash,
        ref,
      }),
    onSuccess: async (d) => {
      setToken(d.accessToken, d.refreshToken);
      // Rolga qarab yo'naltiramiz — ustoz o'z paneliga, oddiy foydalanuvchi dashboardga
      // (admin Telegram orqali kirmaydi, pastdagi alohida forma orqali kiradi).
      try {
        const me = await authApi.me();
        navigate(me.role === "teacher" ? "/teacher" : "/dashboard");
      } catch {
        navigate("/dashboard");
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Telegram'dan qaytganda manzilda `#tgAuthResult=...` bo'ladi — uni bir marta
  // o'qib, kirishni yakunlaymiz (hash darhol tozalanadi, qayta yuborilmasin).
  const handledHash = useRef(false);
  const authMutate = telegramMutation.mutate;
  useEffect(() => {
    if (handledHash.current) return;
    const user = readAuthResultFromHash();
    if (!user) return;
    handledHash.current = true;
    clearAuthHash();
    authMutate(user);
  }, [authMutate]);

  const adminMutation = useMutation({
    mutationFn: () => authApi.adminLogin({ login: adminLogin, password: adminPassword }),
    onSuccess: (d) => {
      setAdminToken(d.accessToken);
      navigate("/admin");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const canSubmitAdmin =
    !!adminLogin.trim() && !!adminPassword && !adminMutation.isPending;

  const startTelegram = () => {
    const botId = configQ.data?.botId;
    if (!botId) {
      toast.error(t("auth.telegramUnavailable"));
      return;
    }
    // Qaytish manzili — shu sahifa (?ref saqlanadi, promokod yo'qolmasin).
    redirectToTelegram(botId, window.location.origin + "/login" + window.location.search);
  };

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
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <LangSwitcher />
          </div>
          <h1 className="text-2xl font-bold text-ink">{t("auth.welcomeTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{t("auth.loginSubtitle")}</p>

          <div className="mt-8 flex flex-col items-center gap-4">
            <TelegramLoginButton
              label={t("auth.telegramSignIn")}
              loading={telegramMutation.isPending || configQ.isLoading}
              disabled={!configQ.data?.botId}
              onClick={startTelegram}
            />
            {ref && (
              <p className="text-xs text-muted">
                {t("auth.refCode")} <span className="font-semibold text-accent">{ref}</span>
              </p>
            )}
          </div>

          <div className="mt-6 border-t border-line pt-4 text-center">
            <button
              type="button"
              onClick={() => setAdminOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-accent"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("auth.adminPanel")}
            </button>
          </div>

          {adminOpen && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 space-y-3 overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmitAdmin) adminMutation.mutate();
              }}
            >
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-10"
                  value={adminLogin}
                  onChange={(e) => setAdminLogin(e.target.value.trim())}
                  placeholder={t("auth.nickLabel")}
                  autoComplete="username"
                />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-10 pr-10"
                  type={showPw ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink"
                  tabIndex={-1}
                  aria-label={showPw ? t("auth.hide") : t("auth.show")}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={!canSubmitAdmin}>
                {adminMutation.isPending ? (
                  <Spinner />
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    {t("auth.signIn")}
                  </>
                )}
              </button>
            </motion.form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
