import { useEffect, useState, type SyntheticEvent } from "react";
import { X, ZoomIn } from "lucide-react";

interface Props {
  src?: string;
  alt?: string;
  /** Ichki (kichik) rasm uchun class */
  imgClassName?: string;
  /** Hoverda chiqadigan ogohlantirish matni */
  hint?: string;
}

/**
 * "tayyorprava.uz" watermark — rasm faylining o'zi o'zgartirilmaydi, faqat
 * ustidan CSS qatlam. Pastki-o'ng burchakda to'q rangdagi matn, pastki-chap
 * burchakda kichik sayt logosi.
 */
const FALLBACK_IMG = "/no-image-car.webp";

/** Rasm URL 404 bo'lsa (fayl o'chgan/tashqi manba yiqilgan) — buzuq rasm belgisi o'rniga fallback. */
function onImgError(e: SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (!el.src.endsWith(FALLBACK_IMG)) el.src = FALLBACK_IMG;
}

function Watermark() {
  return (
    <>
      <img
        src="/logo.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-2 left-2 z-10 h-6 w-6 select-none rounded-full bg-white/80 object-contain p-0.5 shadow-sm"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 right-2 z-10 select-none rounded-md bg-white/80 px-2 py-0.5 text-[13px] font-bold tracking-tight text-slate-900 shadow-sm"
      >
        tayyorprava.uz
      </span>
    </>
  );
}

/**
 * Test/imtihon savol rasmi: ustiga bosilsa yoki "F" tugmasi bosilsa modal ko'rinishida
 * kattalashadi; yana "F" / Esc / bosish — yopiladi. Hoverda ogohlantirish chiqadi.
 */
export function ZoomableImage({
  src,
  alt = "",
  imgClassName,
  hint = "Bosing yoki F — kattalashtirish",
}: Props) {
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setZoom((z) => !z); // F — kattalashtirish / yana F — uz holiga
      } else if (e.key === "Escape") {
        setZoom(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Modal ochiq bo'lsa fon scroll bo'lmasin
  useEffect(() => {
    if (!zoom) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [zoom]);

  return (
    <>
      {/* Ichki rasm — bosiladi, hoverda ogohlantirish */}
      <button
        type="button"
        data-zoom={zoom ? "1" : "0"}
        onClick={() => setZoom(true)}
        className="group relative block w-full cursor-zoom-in"
        title={hint}
      >
        <img src={src} alt={alt} className={imgClassName} onError={onImgError} />
        <Watermark />
        <span className="pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
          <ZoomIn className="h-3.5 w-3.5" /> {hint}
        </span>
      </button>

      {/* Kattalashtirilgan ko'rinish (modal) */}
      {zoom && (
        <div
          onClick={() => setZoom(false)}
          className="animate-fade-in fixed inset-0 z-[200] flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoom(false);
            }}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-zoom-in relative cursor-default"
          >
            <img
              src={src}
              alt={alt}
              onError={onImgError}
              className="max-h-[88vh] max-w-[94vw] rounded-2xl bg-white object-contain shadow-2xl"
            />
            <Watermark />
          </div>
          <span className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
            Yopish uchun: bosing · F · Esc
          </span>
        </div>
      )}
    </>
  );
}
