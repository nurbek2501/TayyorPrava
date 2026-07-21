import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { AtSign, Eye, EyeOff, Lock, LogIn } from "lucide-react";
import { authApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/Spinner";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { BackToHome } from "@/components/shared/BackToHome";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setToken = useAuth((s) => s.setUserToken);
  const setAdminToken = useAuth((s) => s.setAdminToken);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Xavfsizlik tizimi akkauntdan chiqarib yuborgan bo'lsa — sababini ko'rsatamiz
  useEffect(() => {
    const msg = sessionStorage.getItem("pp_block_msg");
    if (msg) {
      toast.error(msg);
      sessionStorage.removeItem("pp_block_msg");
    }
  }, []);

  const mutation = useMutation({
    mutationFn: () => authApi.login({ nickname, password }),
    onSuccess: async (d) => {
      setToken(d.accessToken, d.refreshToken);
      // Bitta umumiy login: rolga qarab yo'naltiramiz — admin o'z paneliga
      // (token adminToken sifatida ham saqlanadi, chunki admin panel so'rovlari
      // shu tokenni /admin/ prefiksli yo'nalishlar uchun kutadi), ustoz o'z
      // paneliga, oddiy foydalanuvchi dashboardga.
      try {
        const me = await authApi.me();
        if (me.role === "admin") {
          setAdminToken(d.accessToken);
          navigate("/admin");
        } else if (me.role === "teacher") {
          navigate("/teacher");
        } else {
          navigate("/dashboard");
        }
      } catch {
        navigate("/dashboard");
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const canSubmit = !!nickname.trim() && !!password && !mutation.isPending;

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

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) mutation.mutate();
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
                  placeholder={t("auth.nickPlaceholder")}
                  autoComplete="username"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">{t("auth.loginNickHint")}</p>
            </div>

            <div>
              <label className="label">{t("auth.password")}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-10 pr-10"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              <div className="mt-2 text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
              {mutation.isPending ? (
                <Spinner />
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  {t("auth.signIn")}
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="font-semibold text-accent hover:underline">
              {t("auth.signUp")}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
