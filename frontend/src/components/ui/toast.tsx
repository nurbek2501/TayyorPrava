import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  remove: (id: number) => void;
}

let counter = 0;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 3500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().push({ type: "success", message }),
  error: (message: string) => useToastStore.getState().push({ type: "error", message }),
  warning: (message: string) => useToastStore.getState().push({ type: "warning", message }),
  info: (message: string) => useToastStore.getState().push({ type: "info", message }),
};

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-accent",
};

export function Toaster() {
  const { toasts, remove } = useToastStore();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="glass-card pointer-events-auto flex items-start gap-3 p-3.5"
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", COLORS[t.type])} />
              <p className="flex-1 text-sm text-ink">{t.message}</p>
              <button onClick={() => remove(t.id)} className="text-muted hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
