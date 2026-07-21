import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Signpost, X } from "lucide-react";
import { assetUrl } from "@/lib/api";
import type { RoadSign } from "@/lib/api";
import { useRoadSigns } from "@/lib/queries";
import { useUiStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/Spinner";
import type { ContentLang } from "@/lib/types";

const LANGS: { code: ContentLang; label: string }[] = [
  { code: "uz", label: "Lotin" },
  { code: "kaa", label: "Кирилл" },
  { code: "ru", label: "Рус" },
];

export function RoadSignsPage() {
  const { data, isLoading } = useRoadSigns();
  const contentLang = useUiStore((s) => s.contentLang);
  const [lang, setLang] = useState<ContentLang>(contentLang);
  const [cat, setCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<(RoadSign & { catName: string }) | null>(null);

  const cats = data?.categories ?? [];
  const q = search.trim().toLowerCase();

  const sections = useMemo(() => {
    const chosen = cat === "all" ? cats : cats.filter((c) => c.code === cat);
    return chosen
      .map((c) => ({
        code: c.code,
        title: c.category[lang] || c.category.uz,
        signs: c.signs.filter(
          (s) => !q || (s.name[lang] || s.name.uz).toLowerCase().includes(q) || s.code.includes(q)
        ),
      }))
      .filter((c) => c.signs.length > 0);
  }, [cats, cat, lang, q]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="chip bg-accent/15 text-accent">
            <Signpost className="mr-1 h-3.5 w-3.5" /> {data?.totalSigns ?? 0} ta belgi
          </span>
          <h1 className="mt-2 text-3xl font-extrabold text-ink">Yo'l belgilari</h1>
          <p className="text-muted">Barcha yo'l belgilari — kategoriyalar bo'yicha, 3 tilda.</p>
        </div>
        {/* Til toggle */}
        <div className="flex gap-1 rounded-xl border border-line/15 bg-bg2/60 p-1">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                lang === l.code ? "bg-accent text-white shadow-glow" : "text-muted hover:text-ink"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kategoriya chiplari */}
      <div className="flex flex-wrap gap-2">
        <CatChip active={cat === "all"} onClick={() => setCat("all")}>
          Hammasi <span className="opacity-60">{data?.totalSigns ?? 0}</span>
        </CatChip>
        {cats.map((c) => (
          <CatChip key={c.code} active={cat === c.code} onClick={() => setCat(c.code)}>
            {c.category[lang] || c.category.uz} <span className="opacity-60">{c.count}</span>
          </CatChip>
        ))}
      </div>

      {/* Qidiruv */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="input pl-9"
          placeholder="Belgi nomidan qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Bo'limlar */}
      {sections.length === 0 ? (
        <div className="py-16 text-center text-muted">Topilmadi</div>
      ) : (
        sections.map((sec) => (
          <section key={sec.code} className="space-y-3">
            {cat === "all" && (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink">{sec.title}</h2>
                <span className="chip bg-bg2/80 text-xs text-muted">{sec.signs.length}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {sec.signs.map((s, i) => (
                <motion.button
                  key={s.code + s.imageUrl}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3), type: "spring", stiffness: 280, damping: 24 }}
                  whileHover={{ y: -5, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActive({ ...s, catName: sec.title })}
                  className="group glass-card glass-hover flex flex-col items-center gap-2 p-3 text-center"
                >
                  <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-white p-2">
                    <img
                      src={assetUrl(s.imageUrl)}
                      alt={s.name[lang]}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  <span className="chip bg-accent/15 text-[11px] font-bold text-accent">{s.code}</span>
                  <span className="line-clamp-2 text-xs font-medium text-ink">
                    {s.name[lang] || s.name.uz}
                  </span>
                </motion.button>
              ))}
            </div>
          </section>
        ))
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card relative w-full max-w-md p-6"
            >
              <button
                onClick={() => setActive(null)}
                className="btn-ghost absolute right-3 top-3 p-2"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-white p-4">
                <img src={assetUrl(active.imageUrl)} alt={active.name[lang]} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="chip bg-accent/15 font-bold text-accent">{active.code}</span>
                <span className="chip bg-bg2/80 text-xs text-muted">{active.catName}</span>
              </div>
              <h3 className="mt-2 text-xl font-extrabold text-ink">{active.name[lang] || active.name.uz}</h3>
              {/* Uchala til */}
              <div className="mt-3 space-y-1 border-t border-line/10 pt-3 text-sm">
                <div><span className="text-muted">Lotin:</span> <span className="text-ink">{active.name.uz}</span></div>
                <div><span className="text-muted">Кирилл:</span> <span className="text-ink">{active.name.kaa}</span></div>
                <div><span className="text-muted">Рус:</span> <span className="text-ink">{active.name.ru}</span></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CatChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
        active
          ? "bg-accent text-white shadow-glow"
          : "border border-line/15 bg-bg2/50 text-muted hover:border-accent/50 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
