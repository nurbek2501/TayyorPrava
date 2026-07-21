import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Rule } from "@/lib/authValidation";

/** Jonli tekshiruv ro'yxati — qoida bajarilsa yashil belgi animatsiya bilan paydo bo'ladi. */
export function RequirementList({
  rules,
  value,
  className,
}: {
  rules: Rule[];
  value: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <ul className={cn("mt-2.5 grid gap-1.5", className)}>
      {rules.map((r, i) => {
        const ok = r.test(value);
        return (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-2 text-xs"
          >
            <motion.span
              animate={{
                scale: ok ? [1, 1.25, 1] : 1,
                backgroundColor: ok ? "rgba(22,163,74,0.18)" : "rgba(148,163,184,0.16)",
              }}
              transition={{ duration: 0.25 }}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
            >
              {ok ? (
                <Check className="h-3 w-3 text-success" strokeWidth={3} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-muted/60" />
              )}
            </motion.span>
            <span className={cn("transition-colors", ok ? "text-success" : "text-muted")}>
              {t(r.key)}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
