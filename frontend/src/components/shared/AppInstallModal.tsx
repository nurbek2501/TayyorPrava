import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Download, Info, Smartphone, WifiOff, X, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isApp } from "@/lib/platform";
import { promptInstall, useCanInstall } from "@/lib/pwaInstall";
import { Modal } from "@/components/ui/Modal";

/** Bir marta ko'rsatiladi — yopilgach shu kalit qo'yiladi. */
const SEEN_KEY = "pp_install_promo_seen";

/**
 * Ro'yxatdan o'tib kirgan foydalanuvchiga bir marta chiqadigan taklif oynasi:
 * ilovani telefon ekraniga o'rnatish. Ilovaning O'ZIDA umuman chiqmaydi.
 *
 * Yopish: burchakdagi X yoki «Keyinroq» — ikkalasi ham qayta chiqmasligini belgilaydi.
 */
export function AppInstallModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const canInstall = useCanInstall();
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (isApp() || localStorage.getItem(SEEN_KEY)) return;
    // Sahifa chizilgach ko'rinsin — birdan "otilib chiqmasin".
    const tm = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(tm);
  }, []);

  const close = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  };

  const install = async () => {
    const res = await promptInstall();
    // iOS Safari / qo'llab-quvvatlamaydigan brauzer — qo'lda ko'rsatma.
    setShowManual(res === "unavailable");
    if (res === "accepted") close();
  };

  const benefits = [
    { icon: Zap, text: t("installModal.benefitFast") },
    { icon: WifiOff, text: t("installModal.benefitOffline") },
    { icon: Bell, text: t("installModal.benefitHandy") },
  ];

  return (
    <Modal open={open} onClose={close} className="max-w-sm overflow-hidden p-0">
      <button
        onClick={close}
        aria-label={t("installModal.later")}
        className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Yuqori qism — gradient va telefon belgisi */}
      <div className="relative overflow-hidden bg-gradient-to-br from-accent to-accent-dark px-6 pb-8 pt-10 text-center">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/20 backdrop-blur"
        >
          <Smartphone className="h-8 w-8 text-white" />
        </motion.div>
        <h3 className="mt-4 text-xl font-extrabold text-white">
          {t("installModal.title")}
        </h3>
        <p className="mt-1.5 text-sm text-white/85">{t("installModal.subtitle")}</p>
      </div>

      {/* Foydalari */}
      <div className="space-y-3 px-6 pt-5">
        {benefits.map((b, i) => (
          <motion.div
            key={b.text}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <b.icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-ink">{b.text}</span>
          </motion.div>
        ))}
      </div>

      {/* Amallar */}
      <div className="px-6 pb-6 pt-5">
        <button onClick={install} className="btn-primary w-full py-3 text-base shadow-glow">
          <Download className="h-5 w-5" />
          {t("installModal.cta")}
        </button>
        {showManual && !canInstall && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("home.installManual")}
          </p>
        )}
        <button
          onClick={close}
          className="mt-3 w-full text-center text-sm font-medium text-muted transition hover:text-ink"
        >
          {t("installModal.later")}
        </button>
      </div>
    </Modal>
  );
}
