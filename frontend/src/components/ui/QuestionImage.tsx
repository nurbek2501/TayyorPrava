import { ZoomableImage } from "./ZoomableImage";

/**
 * Savol rasmi — rasm BOR bo'lsa o'sha rasm, YO'Q bo'lsa TayyorPrava mashina
 * plasholderi.
 *
 * Savollarning ~42% ida (1224 dan 514 tasi) manba ma'lumotining o'zida rasm
 * yo'q — ular faqat matnli savollar. Ularda shu brendli plasholder ko'rsatiladi.
 *
 * MUHIM farq: bu "savolda rasm yo'q" holati. Rasm bor-u YUKLANMAGAN holat
 * boshqacha ko'rinadi (ZoomableImage ichidagi qizil "Rasm yuklanmadi") —
 * shunda nosozlikni plasholder bilan chalkashtirib yubormaymiz.
 */
const NO_IMAGE_SRC = "/no-image-car.webp";

interface Props {
  /** To'liq manzil (assetUrl bilan). Bo'sh/undefined — savolda rasm yo'q. */
  src?: string | null;
  /** Rasm elementiga beriladigan class (sahifa o'lchamni o'zi belgilaydi) */
  imgClassName?: string;
}

export function QuestionImage({ src, imgClassName }: Props) {
  return <ZoomableImage src={src || NO_IMAGE_SRC} imgClassName={imgClassName} />;
}
