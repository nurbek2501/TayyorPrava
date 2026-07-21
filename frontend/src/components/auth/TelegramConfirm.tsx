import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Clock, Loader2, Send } from "lucide-react";
import { authApi, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/Spinner";
import { OtpInput } from "./OtpInput";

interface Props {
  nickname: string;
  botUsername: string;
  channel?: string; // ishlatilmaydi — obunani bot tekshiradi
  /** 5 xonali kod kiritilganda chaqiriladi; xato bo'lsa throw qilishi kerak. */
  verify: (code: string) => Promise<void>;
  onBack: () => void;
  title?: string;
  subtitle?: string;
}

export function TelegramConfirm({
  nickname,
  botUsername,
  verify,
  onBack,
  title,
  subtitle,
}: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [remaining, setRemaining] = useState(0);
  const expiredRef = useRef(false);

  const botUrl = `https://t.me/${botUsername}?start=${nickname}`;

  // Backenddan kod holatini muntazam so'rab turamiz (teskari sanoq uchun)
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await authApi.codeStatus(nickname);
        if (!alive) return;
        if (s.active && s.remainingSeconds > 0) {
          expiredRef.current = false;
          setRemaining(s.remainingSeconds);
        } else {
          setRemaining(0);
        }
      } catch {
        /* tarmoq xatosi — keyingi pollda qayta urinamiz */
      }
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [nickname]);

  // Har soniyada mahalliy sanoq (silliq countdown)
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          expiredRef.current = true;
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining > 0]);

  const verifyM = useMutation({
    mutationFn: () => verify(code),
    onError: (e) => {
      toast.error(getErrorMessage(e));
      setCode("");
    },
  });

  // 5 ta raqam kiritilsa — avtomatik tasdiqlash
  useEffect(() => {
    if (code.length === 5 && !verifyM.isPending) verifyM.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const active = remaining > 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const danger = remaining > 0 && remaining <= 30;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16 }}
    >
      <button onClick={onBack} className="btn-ghost mb-4 text-sm">
        <ArrowLeft className="h-4 w-4" />
        {t("auth.back")}
      </button>

      {/* Sarlavha — animatsiyali Telegram ikonkasi */}
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 shadow-glow ring-1 ring-white/10"
        >
          <Send className="h-8 w-8 text-white" />
          <motion.span
            className="absolute inset-0 rounded-2xl ring-2 ring-sky-400/50"
            animate={{ scale: [1, 1.25], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
        </motion.div>
        <h1 className="text-xl font-bold text-ink">{title ?? t("auth.tgTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle ?? t("auth.tgSubtitle")}</p>
      </div>

      {/* Asosiy amal: botni ochish (obunani bot tekshiradi) */}
      <motion.a
        href={botUrl}
        target="_blank"
        rel="noreferrer"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="group relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 to-blue-700 py-3.5 text-base font-bold text-white shadow-glow"
      >
        <span
          className="pointer-events-none absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-700 group-hover:translate-x-full"
          style={{ clipPath: "polygon(20% 0, 40% 0, 20% 100%, 0% 100%)" }}
        />
        <Send className="h-5 w-5" />
        {t("auth.tgOpenBot")}
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </motion.a>
      <p className="mt-2 text-center text-xs text-muted">
        <code className="rounded bg-accent/15 px-1.5 py-0.5 font-bold text-accent">
          {nickname}
        </code>{" "}
        — {t("auth.tgBotHint")}
      </p>

      {/* Kod kiritish */}
      <div className="mt-6 border-t border-line/10 pt-5">
        <p className="mb-3 text-center text-sm font-medium text-ink">
          {t("auth.tgStep3")}
        </p>
        <OtpInput value={code} onChange={setCode} disabled={verifyM.isPending} />

        {/* Holat / teskari sanoq */}
        <div className="mt-4 flex items-center justify-center">
          {verifyM.isPending ? (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> {t("auth.tgChecking")}
            </span>
          ) : active ? (
            <motion.span
              key="cd"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold tabular-nums",
                danger ? "bg-danger/15 text-danger" : "bg-success/15 text-success"
              )}
            >
              <Clock className="h-4 w-4" />
              {t("auth.tgValid", { time: `${mm}:${ss}` })}
            </motion.span>
          ) : expiredRef.current ? (
            <span className="text-center text-sm font-medium text-danger">
              {t("auth.tgExpired")}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("auth.tgWaiting")}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
