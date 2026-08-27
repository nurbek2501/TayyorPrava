import { useState } from "react";
import { Download, Info, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isApp } from "@/lib/platform";
import { promptInstall, useCanInstall, useIsInstalled } from "@/lib/pwaInstall";

/**
 * Saytdagi «ilova» bo'limi — ilovani telefon ekraniga o'rnatish tugmasi (PWA).
 * Ilovaning O'ZIDA (standalone) yoki o'rnatilgandan keyin — umuman ko'rinmaydi
 * (Android/iOS do'kon tugmalari yo'q).
 *
 * O'rnatish taklifi `lib/pwaInstall` da ERTA ushlanadi — shu sabab tugma bosilishi
 * bilan brauzerning o'rnatish oynasi ochiladi (qo'lda ko'rsatma faqat taklifni
 * umuman qo'llab-quvvatlamaydigan brauzerlarda chiqadi, masalan iOS Safari).
 */
export function InstallApp() {
  const { t } = useTranslation();
  const canInstall = useCanInstall();
  const installed = useIsInstalled();
  const [showManual, setShowManual] = useState(false);

  // Ilovada (standalone) yoki o'rnatilgandan so'ng — hech narsa ko'rsatmaymiz.
  if (isApp() || installed) return null;

  const handle = async () => {
    const res = await promptInstall();
    // iOS Safari / qo'llab-quvvatlamaydigan brauzer — qo'lda ko'rsatma.
    setShowManual(res === "unavailable");
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
      {showManual && !canInstall && (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {t("home.installManual")}
        </p>
      )}
    </div>
  );
}
