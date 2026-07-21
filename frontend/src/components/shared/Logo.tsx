import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Brend belgisi: TayyorPrava g'ildirak logosi (shaffof fonli PNG).
 * Aylana shaklida — har qanday fonda toza, responsive'da nisbati buzilmaydi.
 */
export function LogoMark({ size = 42, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="TayyorPrava"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("object-contain", className)}
    />
  );
}

export function Logo({ admin = false, compact = false }: { admin?: boolean; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={compact ? 34 : 42} className="logo-glow shrink-0" />
      {!compact && (
        <div className="leading-none">
          <div className="text-lg font-extrabold tracking-tight">
            <span className="text-ink">Tayyor</span>
            <span className="bg-gradient-to-r from-accent to-accent-dark bg-clip-text text-transparent">
              Prava
            </span>
          </div>
          <div
            className={cn(
              "mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted"
            )}
          >
            {admin ? t("admin.panel") : "Avtotest"}
          </div>
        </div>
      )}
    </div>
  );
}
