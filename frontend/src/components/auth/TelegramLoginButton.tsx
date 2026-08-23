import { Send } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  label: string;
  /** Telegram ruxsat sahifasi manzili. Bo'lmasa (sozlama yuklanmagan) tugma o'chiq. */
  href?: string;
  /** Kompyuterda `true` — yangi tabda ochiladi, login sahifasi ochiq qoladi. */
  newTab?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

const CLASS =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-5 py-3 font-semibold text-white shadow-glow transition hover:bg-[#229ED9]";

/** Saytdagi yagona «Telegram orqali kirish» tugmasi.
 *
 * Bu ODDIY HAVOLA (tugma emas): brauzerlar `window.open`ni bloklashi mumkin,
 * havolani esa hech qachon bloklamaydi — shuning uchun yangi tab ishonchli ochiladi.
 *
 * `rel="opener"` MUHIM: `target="_blank"` zamonaviy brauzerlarda `noopener`ni
 * o'zi qo'yadi, u holda yangi tab natijani `window.opener` orqali qaytara olmaydi.
 */
export function TelegramLoginButton({ label, href, newTab, loading, onClick }: Props) {
  if (loading || !href) {
    return (
      <button type="button" disabled className={`${CLASS} opacity-60`}>
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

  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "opener" : undefined}
      onClick={onClick}
      className={CLASS}
    >
      <Send className="h-5 w-5" />
      {label}
    </a>
  );
}
