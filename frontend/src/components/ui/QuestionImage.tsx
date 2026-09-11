import { ImageOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ZoomableImage } from "./ZoomableImage";

/**
 * Savol rasmi — rasm BOR bo'lsa kattalashtiriladigan rasm, YO'Q bo'lsa aniq
 * "rasm yo'q" holati.
 *
 * NEGA kerak: savollarning ~42% ida (1224 dan 514 tasi) manba ma'lumotining
 * o'zida rasm yo'q — ular faqat matnli savollar. Ilgari bunday savollarda
 * TayyorPrava brendli MASHINA fotosi ko'rsatilardi; foydalanuvchi buni
 * "rasm yuklanmadi" deb tushunardi ("rasmlar kelmayapti" shikoyati shundan).
 * Endi bo'sh holat foto emas — kulrang panel + belgi + matn, ya'ni chalkashmaydi.
 */

const NO_IMAGE_TXT = {
  uz: "Bu savolda rasm yo'q",
  kr: "Бу саволда расм йўқ",
  ru: "В этом вопросе нет изображения",
} as const;

type Lang = keyof typeof NO_IMAGE_TXT;

interface Props {
  /** To'liq manzil (assetUrl bilan). Bo'sh/undefined — savolda rasm yo'q. */
  src?: string | null;
  /** Rasm elementiga beriladigan class (sahifa o'lchamni o'zi belgilaydi) */
  imgClassName?: string;
  /** "Rasm yo'q" paneliga qo'shimcha class */
  emptyClassName?: string;
}

export function QuestionImage({ src, imgClassName, emptyClassName }: Props) {
  const { i18n } = useTranslation();

  if (src) return <ZoomableImage src={src} imgClassName={imgClassName} />;

  const lang: Lang = (["uz", "kr", "ru"] as const).includes(i18n.language as Lang)
    ? (i18n.language as Lang)
    : "uz";

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-10 text-center",
        "border border-dashed border-white/10 bg-white/[0.03] text-slate-400",
        emptyClassName
      )}
    >
      <ImageOff className="h-7 w-7 opacity-50" aria-hidden />
      <span className="text-[13px] font-medium">{NO_IMAGE_TXT[lang]}</span>
    </div>
  );
}
