import { motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

// `open` false bo'lganda darhol `null` qaytaramiz — modal DOM'dan ishonchli
// olib tashlanadi (AnimatePresence exit'iga bog'liq emas). Kirish animatsiyasi
// saqlanadi.
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  if (!open) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className={cn("glass-card relative z-10 w-full max-w-lg p-6", className)}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted transition hover:bg-card hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Ha",
  cancelText = "Yo'q",
  danger,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel} className="max-w-md">
      <button
        onClick={onCancel}
        aria-label={cancelText}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-muted transition hover:bg-card hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
      <h3 className="pr-8 text-lg font-bold text-ink">{title}</h3>
      {description && <div className="mt-2 text-sm text-muted">{description}</div>}
      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          className="btn-ghost flex flex-1 items-center justify-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={cn("flex-1", danger ? "btn-danger" : "btn-primary")}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
