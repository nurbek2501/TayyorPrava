import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Loader2,
  MessageCircle,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getErrorMessage, teachersApi } from "@/lib/api";
import type { TeacherPublic, TeacherTariff } from "@/lib/api";
import { cn, initials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";

const METHODS = [
  { code: "click", label: "Click" },
  { code: "payme", label: "Payme" },
  { code: "card", label: "Bank karta" },
];

function PurchaseModal({
  teacher,
  onClose,
  onDone,
}: {
  teacher: TeacherPublic;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tariff, setTariff] = useState<TeacherTariff | null>(
    teacher.tariffs[0] ?? null
  );
  const [method, setMethod] = useState("click");
  const qc = useQueryClient();
  const buy = useMutation({
    mutationFn: () => teachersApi.purchase(teacher.id, tariff!.id, method),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Kirish ochildi — endi ustozga yozishingiz mumkin!");
      onDone();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-zoom-in relative w-full max-w-sm rounded-3xl border border-line/15 bg-card p-6 shadow-glass"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted transition hover:text-ink"
          aria-label="Yopish"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-blue-900 text-lg font-bold text-white shadow-glow">
            {initials(teacher.name)}
          </div>
          <h2 className="text-lg font-bold text-ink">
            {teacher.name} {teacher.surname || ""}
          </h2>
          <p className="text-xs text-muted">
            {teacher.experienceYears} yil tajriba · maslahat xizmati
          </p>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-medium text-muted">Muddatni tanlang</div>
          <div className="space-y-2">
            {teacher.tariffs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTariff(t)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-semibold transition",
                  tariff?.id === t.id
                    ? "border-accent bg-accent/10 text-ink"
                    : "border-line/20 text-muted hover:text-ink"
                )}
              >
                <span>{t.days} kun</span>
                <span>{t.price.toLocaleString("ru-RU")} so'm</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-muted">To'lov usuli</div>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.code}
                onClick={() => setMethod(m.code)}
                className={cn(
                  "rounded-xl border-2 py-2.5 text-sm font-semibold transition",
                  method === m.code
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line/20 text-muted hover:text-ink"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => buy.mutate()}
          disabled={!tariff || buy.isPending}
          className="btn-primary mt-5 w-full py-3 shadow-glow"
        >
          {buy.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="h-5 w-5" />
              {tariff ? `${tariff.price.toLocaleString("ru-RU")} so'm to'lash` : "Tarif yo'q"}
            </>
          )}
        </button>
        <p className="mt-3 text-center text-[11px] text-muted">
          🔒 To'lovdan so'ng ustoz bilan suhbat darhol ochiladi
        </p>
      </div>
    </div>
  );
}

export function TeachersPage() {
  const navigate = useNavigate();
  const { data: teachers, isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: teachersApi.list,
  });
  const [buying, setBuying] = useState<TeacherPublic | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <span className="chip bg-accent/15 text-accent">
          <GraduationCap className="h-3.5 w-3.5" />
          Ustozdan so'rash
        </span>
        <h1 className="mt-2 text-2xl font-extrabold text-ink">
          Tajribali ustozlardan maslahat oling
        </h1>
        <p className="mt-1 text-sm text-muted">
          Savolingizni yozing — ustoz sayt chatida javob beradi. Xizmat pullik,
          narx ustoz tajribasiga qarab belgilanadi.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : !teachers?.length ? (
        <div className="glass-card p-10 text-center text-muted">
          Hozircha ustozlar yo'q — tez orada qo'shiladi.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((tch, i) => {
            const minPrice = tch.tariffs.length
              ? Math.min(...tch.tariffs.map((t) => t.price))
              : null;
            return (
              <motion.div
                key={tch.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                className="glass-card flex flex-col p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-blue-900 font-bold text-white shadow-glow">
                    {initials(tch.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-ink">
                      {tch.name} {tch.surname || ""}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <Award className="h-3.5 w-3.5 text-warning" />
                      {tch.experienceYears} yil tajriba
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tch.tariffs.map((t) => (
                    <span key={t.id} className="chip bg-bg2/70 text-muted">
                      {t.days} kun · {t.price.toLocaleString("ru-RU")} so'm
                    </span>
                  ))}
                  {!tch.tariffs.length && (
                    <span className="chip bg-bg2/70 text-muted">Narx belgilanmagan</span>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  {tch.hasAccess ? (
                    <button
                      onClick={() => navigate(`/teachers/${tch.id}/chat`)}
                      className="btn-primary w-full shadow-glow"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Suhbatga kirish
                    </button>
                  ) : (
                    <button
                      onClick={() => setBuying(tch)}
                      disabled={!tch.tariffs.length}
                      className="btn-primary w-full shadow-glow disabled:opacity-50"
                    >
                      <CreditCard className="h-4 w-4" />
                      {minPrice != null
                        ? `Murojaat qilish · ${minPrice.toLocaleString("ru-RU")} so'mdan`
                        : "Murojaat qilish"}
                    </button>
                  )}
                  {tch.hasAccess && tch.accessExpiresAt && (
                    <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Kirish aktiv: {new Date(tch.accessExpiresAt).toLocaleDateString("ru-RU")} gacha
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {buying && (
        <PurchaseModal
          teacher={buying}
          onClose={() => setBuying(null)}
          onDone={() => {
            const id = buying.id;
            setBuying(null);
            navigate(`/teachers/${id}/chat`);
          }}
        />
      )}
    </div>
  );
}
