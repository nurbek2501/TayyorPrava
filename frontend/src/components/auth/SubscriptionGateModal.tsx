import { RefreshCw, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface Props {
  open: boolean;
  channel: string;
  channelUrl: string;
  onRecheck: () => void;
  isChecking?: boolean;
}

/** Testlarni yechishdan oldin kanalga obuna talab qiladi — orqa fon bosilsa ham
 * yopilmaydi (onClose bo'sh), faqat obuna tasdiqlangach yo'qoladi. */
export function SubscriptionGateModal({
  open,
  channel,
  channelUrl,
  onRecheck,
  isChecking,
}: Props) {
  return (
    <Modal open={open} onClose={() => {}}>
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Send className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-ink">Kanalga obuna bo'ling</h3>
        <p className="mt-2 text-sm text-muted">
          Testlarni yechish uchun avval bizning {channel} Telegram kanalimizga
          obuna bo'ling.
        </p>
        <div className="mt-6 flex w-full flex-col gap-3">
          <a
            href={channelUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            Kanalga o'tish
          </a>
          <button
            onClick={onRecheck}
            disabled={isChecking}
            className="btn-ghost flex w-full items-center justify-center gap-2"
          >
            <RefreshCw className={isChecking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isChecking ? "Tekshirilmoqda..." : "Obunani tekshirish"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
