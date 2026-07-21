import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chiroyli, animatsiyali «orqaga» tugmasi — glassy pill + gradient ikonka. */
export function BackButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-full border border-line/15 bg-card/70 py-1.5 pl-1.5 pr-4 text-sm font-bold text-ink shadow-glass backdrop-blur-xl transition hover:border-accent/40 hover:bg-card",
        className
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow transition-transform duration-300 group-hover:-translate-x-0.5">
        <ArrowLeft className="h-4 w-4" />
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </motion.button>
  );
}
