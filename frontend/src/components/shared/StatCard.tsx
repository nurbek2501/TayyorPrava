import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";
import { cn, formatNumber } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  delay?: number;
  accent?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  delay = 0,
  accent = true,
  loading = false,
  onClick,
}: StatCardProps) {
  const animated = useCountUp(loading ? 0 : value);
  const clickable = !!onClick;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={clickable ? { scale: 1.02, y: -3 } : undefined}
      whileTap={clickable ? { scale: 0.98 } : undefined}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
      className={cn("glass-card glass-hover group p-5", clickable && "cursor-pointer")}
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300",
          clickable && "group-hover:scale-110",
          accent ? "bg-accent/15 text-accent" : "bg-card text-muted"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="skeleton h-9 w-24" />
        ) : (
          <div className="text-3xl font-extrabold text-accent">
            {formatNumber(animated)}
            {suffix}
          </div>
        )}
        <div className="mt-1 text-sm text-muted">{label}</div>
      </div>
    </motion.div>
  );
}
