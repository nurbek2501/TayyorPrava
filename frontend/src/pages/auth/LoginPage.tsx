import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn, Send, ShieldCheck, User } from "lucide-react";
import { authApi, getErrorMessage } from "@/lib/api";
import {
  clearAuthHash,
  isAuthTab,
  openTelegramAuth,
  readAuthResultFromHash,
  sendResultToOpener,
  TELEGRAM_APP_URL,
  TG_AUTH_MESSAGE,
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
  // Kompyuterda Telegram yangi tabda ochilgach — bu sahifa kutish holatiga o'tadi
  // va «Telegram'ni ochish» tugmasini ko'rsatadi (tasdiqlash so'roviga tez o'tish uchun).
  const [waiting, setWaiting] = useState(false);
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
  // Agar biz Telegram uchun ochilgan YANGI TABda bo'lsak (kompyuter oqimi) —
  // natijani asosiy sahifaga uzatib, o'zimizni yopamiz.
  const handledHash = useRef(false);
  const authMutate = telegramMutation.mutate;
  useEffect(() => {
    if (handledHash.current) return;
    const user = readAuthResultFromHash();
    if (!user) return;
    handledHash.current = true;
    clearAuthHash();
    if (isAuthTab() && sendResultToOpener(user)) return;
    authMutate(user);
  }, [authMutate]);

  // Asosiy sahifa: yangi tabdan kelgan natijani qabul qiladi.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Faqat o'z originimizdan kelgan xabarga ishonamiz.
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== TG_AUTH_MESSAGE || !e.data?.user) return;
      if (handledHash.current) return;
      handledHash.current = true;
      setWaiting(false);
      authMutate(e.data.user as TelegramAuthUser);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
    const returnTo = window.location.origin + "/login" + window.location.search;
    // Yangi tab ochilgan bo'lsa (kompyuter) — sahifa ochiq qoladi, kutish holatiga o'tamiz.
    if (openTelegramAuth(botId, returnTo)) setWaiting(true);
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

            {/* Kompyuter oqimi: Telegram yangi tabda ochilgan — bu yerda tasdiqlash
                so'rovi keladigan Telegram chatiga tez o'tish tugmasi turadi. */}
            {waiting && !telegramMutation.isPending && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-xl bg-accent/10 p-4 text-center"
              >
                <p className="text-sm text-ink">{t("auth.confirmInTelegram")}</p>
                <a
                  href={TELEGRAM_APP_URL}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-2.5 font-semibold text-white transition hover:bg-[#229ED9]"
                >
                  <Send className="h-4 w-4" />
                  {t("auth.openTelegram")}
                </a>
                <p className="mt-2 text-[11px] text-muted">{t("auth.openTelegramHint")}</p>
              </motion.div>
            )}

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
