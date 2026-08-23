import { Send } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** Saytdagi yagona «Telegram orqali kirish» tugmasi.
 *
 * Bosilganda foydalanuvchi Telegram'ning ruxsat berish sahifasiga o'tadi
 * (iframe widget emas — o'z uslubimizdagi oddiy tugma).
 */
export function TelegramLoginButton({ label, loading, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-5 py-3 font-semibold text-white shadow-glow transition hover:bg-[#229ED9] disabled:opacity-60"
    >
      {loading ? (
        <Spinner />
      ) : (
        <>
          <Send className="h-5 w-5" />
          {label}
        </>
      )}
    </button>
  );
}
