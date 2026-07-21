import { useEffect, useState } from "react";
import { Download, Info, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isApp } from "@/lib/platform";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Saytdagi «ilova» bo'limi — ilovani telefon ekraniga o'rnatish tugmasi (PWA).
 * Ilovaning O'ZIDA (standalone) yoki o'rnatilgandan keyin — umuman ko'rinmaydi
 * (Android/iOS do'kon tugmalari yo'q).
 */
export function InstallApp() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Ilovada (standalone) yoki o'rnatilgandan so'ng — hech narsa ko'rsatmaymiz.
  if (isApp() || hidden) return null;

  const handle = async () => {
    if (!deferred) {
      // iOS Safari / qo'llab-quvvatlamaydigan brauzer — qo'lda ko'rsatma.
      setShowManual(true);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setHidden(true);
    setDeferred(null);
  };

  return (
    <div>
      <button
        onClick={handle}
        className="glass-card glass-hover group flex w-full items-center gap-4 p-4 text-left"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow transition-transform duration-300 group-hover:scale-110">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-ink">{t("home.installApp")}</div>
          <div className="truncate text-sm text-muted">{t("home.installHint")}</div>
        </div>
        <Download className="h-5 w-5 shrink-0 text-accent" />
      </button>
      {showManual && (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {t("home.installManual")}
        </p>
      )}
    </div>
  );
}
