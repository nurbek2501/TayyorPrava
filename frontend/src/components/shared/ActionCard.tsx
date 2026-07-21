import { motion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  delay?: number;
}

export function ActionCard({ icon: Icon, title, subtitle, onClick, delay = 0 }: ActionCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="glass-card glass-hover flex w-full items-center gap-4 p-5 text-left"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-ink">{title}</div>
        {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
      </div>
      <ChevronRight className="h-5 w-5 text-muted" />
    </motion.button>
  );
}
