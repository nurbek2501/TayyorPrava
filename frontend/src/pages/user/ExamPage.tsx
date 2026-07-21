import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookCheck,
  Brain,
  ChevronRight,
  ClipboardList,
  Clock,
  ListChecks,
  Minus,
  Play,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ActionCard } from "@/components/shared/ActionCard";
import { useUiStore } from "@/store/ui";
import { cn, formatClock } from "@/lib/utils";
import type { UiLang } from "@/lib/types";

const SMART_CARD: Record<UiLang, { name: string; desc: string; badge: string }> = {
  uz: { name: "Aqlli test", desc: "Bilmagan savollaringizni o'zlashtiring", badge: "yangi" },
  kr: { name: "Ақлли тест", desc: "Билмаган саволларингизни ўзлаштиринг", badge: "янги" },
  ru: { name: "Умный тест", desc: "Освойте вопросы, которые не знаете", badge: "новое" },
};

export function ExamPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uiLang = useUiStore((s) => s.uiLang);
  const smart = SMART_CARD[uiLang] ?? SMART_CARD.uz;
  const [oraliqOpen, setOraliqOpen] = useState(false);
  const [count, setCount] = useState(20);

  const clamp = (n: number) => Math.max(1, Math.min(100, Math.round(n) || 0));
  const seconds = count * 75; // har savolga 1.25 daqiqa = 75 soniya

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-ink">{t("nav.exam")}</h1>

      {/* Aqlli test — yangi featured rejim */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate("/smart-test")}
        className="group relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-700 p-6 text-left text-white shadow-glow ring-1 ring-white/10 transition-transform hover:-translate-y-0.5"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur transition-transform duration-300 group-hover:scale-110">
            <Brain className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold">{smart.name}</h2>
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase">
                {smart.badge}
              </span>
            </div>
            <p className="text-sm text-white/85">{smart.desc}</p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
        </div>
      </motion.button>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ActionCard
          icon={BookCheck}
          title="Mavzular bo'yicha imtihon"
          subtitle="Tanlangan mavzu bo'yicha"
          onClick={() => navigate("/lesson")}
          delay={0}
        />
        <button
          onClick={() => setOraliqOpen((o) => !o)}
          className={cn(
            "glass-card glass-hover group flex items-center gap-4 p-5 text-left transition-all",
            oraliqOpen && "border-accent/50 shadow-glow"
          )}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow transition-transform duration-300 group-hover:scale-110">
            <ClipboardList className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-ink">Oraliq nazorat</div>
            <div className="truncate text-sm text-muted">Savol sonini tanlang</div>
          </div>
        </button>
        <ActionCard
          icon={ListChecks}
          title="Biletlar bo'yicha imtihon topshirish"
          subtitle="Bilet savollari bo'yicha"
          onClick={() => navigate("/tickets")}
          delay={0.1}
        />
      </div>

      {/* Oraliq nazorat — savol soni inputi (animatsion) */}
      {oraliqOpen && (
        <motion.div
          initial={{ opacity: 0, y: -14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="glass-card mx-auto max-w-md p-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-ink">Oraliq nazorat</h3>
              <p className="text-xs text-muted">Nechta savol bo'lsin?</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => setCount((c) => clamp(c - 5))}
              className="btn-ghost h-12 w-12 rounded-full p-0"
              aria-label="kamaytirish"
            >
              <Minus className="h-5 w-5" />
            </button>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(clamp(Number(e.target.value)))}
              className="input w-24 text-center text-3xl font-extrabold"
              min={1}
              max={100}
            />
            <button
              onClick={() => setCount((c) => clamp(c + 5))}
              className="btn-ghost h-12 w-12 rounded-full p-0"
              aria-label="ko'paytirish"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 flex flex-col items-center gap-1 rounded-xl bg-accent/10 py-3 text-accent">
            <div className="flex items-center gap-2 text-lg font-extrabold">
              <Clock className="h-5 w-5" />
              {count} savol · {formatClock(seconds)}
            </div>
            <div className="text-[11px] font-medium text-accent/70">
              har savolga 1.25 daqiqa
            </div>
          </div>

          <button
            onClick={() => navigate(`/lesson/oraliq-${count}`)}
            className="btn-primary mt-5 w-full py-3 text-base shadow-glow"
          >
            <Play className="h-5 w-5" />
            Boshlash
          </button>
        </motion.div>
      )}
    </div>
  );
}
