import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, PartyPopper, ShieldAlert } from "lucide-react";

/** Ro'yxatdan o'tgach: nikni eslab qolishga chaqiruvchi animatsiyali ogohlantirish. */
export function NicknameSavedModal({
  nickname,
  onContinue,
}: {
  nickname: string;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(nickname);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard ruxsati yo'q — e'tibor bermaymiz */
    }
  };

  return (
    <div className="animate-fade-in fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-zoom-in w-full max-w-sm rounded-3xl border border-line/15 bg-card p-7 text-center shadow-glass">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-success to-emerald-600 shadow-glow ring-1 ring-white/10">
          <PartyPopper className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-ink">{t("auth.nickSavedTitle")}</h2>

        {/* Nik — nusxa olinadigan */}
        <div className="my-5">
          <div className="text-xs font-medium text-muted">{t("auth.nickSavedLabel")}</div>
          <button
            onClick={copy}
            className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-accent/30 bg-accent/10 py-3 text-2xl font-extrabold tracking-wide text-ink transition hover:bg-accent/15"
            title="Nusxa olish"
          >
            {nickname}
            {copied ? (
              <Check className="h-5 w-5 text-success" />
            ) : (
              <Copy className="h-5 w-5 text-muted" />
            )}
          </button>
          <div className="mt-1 h-4 text-xs font-medium text-success">
            {copied ? t("auth.copied") : ""}
          </div>
        </div>

        {/* Ogohlantirish */}
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-left">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-ink/90">{t("auth.nickSavedWarn")}</p>
        </div>

        <button onClick={onContinue} className="btn-primary w-full py-3 shadow-glow">
          {t("auth.nickSavedBtn")}
        </button>
      </div>
    </div>
  );
}
