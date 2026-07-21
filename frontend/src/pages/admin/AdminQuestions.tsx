import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  Languages,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { API_ORIGIN, getErrorMessage, questionsApi } from "@/lib/api";
import { useAdminQuestions, useTopics } from "@/lib/queries";
import { latToCyr } from "@/lib/translit";
import { cn, formatDate } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import type { Question } from "@/lib/types";

interface Opt {
  lat: string;
  cyr: string;
  rus: string;
  correct: boolean;
}
const emptyOpt = (correct = false): Opt => ({ lat: "", cyr: "", rus: "", correct });
type DupState = "idle" | "checking" | "new" | "exists";

/** Raqamli bo'lim sarlavhasi */
function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
        {n}
      </span>
      <span className="text-sm font-semibold text-ink">{children}</span>
    </div>
  );
}

export function AdminQuestions() {
  const qc = useQueryClient();
  const { data: topics } = useTopics();

  // ---- forma ----
  const [topicId, setTopicId] = useState<number | undefined>(undefined);
  const [qLat, setQLat] = useState("");
  const [qCyr, setQCyr] = useState("");
  const [qRus, setQRus] = useState("");
  const [options, setOptions] = useState<Opt[]>([emptyOpt(true), emptyOpt()]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dup, setDup] = useState<DupState>("idle");
  const [dupText, setDupText] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showTr, setShowTr] = useState(false); // tarjimalar ko'rinishi

  // ---- ro'yxat ----
  const [filterTopic, setFilterTopic] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);

  const list = useAdminQuestions({ topicId: filterTopic, search: search || undefined, page });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  useEffect(() => {
    if (topicId === undefined && topics?.length) setTopicId(topics[0].id);
  }, [topics, topicId]);

  // ---- QATTIQ takror tekshiruvi (jonli) ----
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const text = qLat.trim();
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!text) {
      setDup("idle");
      setDupText(null);
      return;
    }
    setDup("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await questionsApi.check(text);
        setDup(res.exists ? "exists" : "new");
        setDupText(res.duplicateText ?? null);
      } catch {
        setDup("idle");
      }
    }, 300);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [qLat]);

  const topicName = (id: number) => topics?.find((x) => x.id === id)?.nameUz ?? `#${id}`;

  const onQLat = (v: string) => {
    setQLat(v);
    setQCyr(latToCyr(v));
  };
  const setOpt = (i: number, patch: Partial<Opt>) =>
    setOptions((os) => os.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const onOptLat = (i: number, v: string) => setOpt(i, { lat: v, cyr: latToCyr(v) });
  const setCorrect = (i: number) =>
    setOptions((os) => os.map((o, idx) => ({ ...o, correct: idx === i })));
  const addOption = () => setOptions((os) => (os.length < 5 ? [...os, emptyOpt()] : os));
  const removeOption = (i: number) =>
    setOptions((os) => (os.length > 2 ? os.filter((_, idx) => idx !== i) : os));

  const translateRu = async () => {
    const texts = [qLat, ...options.map((o) => o.lat)];
    setTranslating(true);
    setShowTr(true);
    try {
      const res = await questionsApi.translate(texts);
      if (!res.ok) toast.warning("Tarjima xizmati javob bermadi (internet?)");
      setQRus(res.translations[0] ?? "");
      setOptions((os) => os.map((o, i) => ({ ...o, rus: res.translations[i + 1] ?? o.rus })));
      if (res.ok) toast.success("Rus tarjimasi tayyor");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setTranslating(false);
    }
  };
  const regenCyr = () => {
    setQCyr(latToCyr(qLat));
    setOptions((os) => os.map((o) => ({ ...o, cyr: latToCyr(o.lat) })));
    toast.success("Kirill yangilandi");
  };

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const reset = () => {
    setQLat("");
    setQCyr("");
    setQRus("");
    setOptions([emptyOpt(true), emptyOpt()]);
    setImageFile(null);
    setImagePreview(null);
    setDup("idle");
    setDupText(null);
    setShowTr(false);
  };

  const validOptions = options.filter((o) => o.lat.trim());
  const hasCorrect = options.some((o) => o.correct && o.lat.trim());
  const canSave =
    topicId !== undefined && dup === "new" && validOptions.length >= 2 && hasCorrect;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const created = await questionsApi.create({
        topicId,
        text: { uz: qLat.trim(), kaa: qCyr.trim() || latToCyr(qLat), ru: qRus.trim() },
        options: validOptions.map((o) => ({
          text: { uz: o.lat.trim(), kaa: o.cyr.trim() || latToCyr(o.lat), ru: o.rus.trim() },
          isCorrect: o.correct,
        })),
      });
      if (imageFile) await questionsApi.uploadImage(created.id, imageFile);
      return created;
    },
    onSuccess: () => {
      toast.success("✓ Yangi savol bazaga qo'shildi");
      qc.invalidateQueries({ queryKey: ["adminQuestions"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      reset();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionsApi.remove(id),
    onSuccess: () => {
      toast.success("Savol o'chirildi");
      qc.invalidateQueries({ queryKey: ["adminQuestions"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const langBadges = (q: Question) =>
    (["uz", "kaa", "ru"] as const).filter((l) => q.text[l]?.trim());

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-blue-700 text-white shadow-glow">
          <ListChecks className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Savollar</h1>
          <p className="text-sm text-muted">
            Yangi savol qo'shing yoki bazani boshqaring. Takror savollar avtomatik
            aniqlanadi.
          </p>
        </div>
      </motion.div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {/* ============ Chap: forma ============ */}
        <motion.section
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-3xl border border-line/15 bg-card/70 shadow-glass backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 border-b border-line/10 bg-accent/5 px-5 py-3.5">
            <Plus className="h-5 w-5 text-accent" />
            <h2 className="font-bold text-ink">Yangi savol qo'shish</h2>
          </div>

          <div className="space-y-5 p-5">
            {/* 1. Mavzu */}
            <div>
              <StepLabel n={1}>Mavzuni tanlang</StepLabel>
              <select
                className="input"
                value={topicId ?? ""}
                onChange={(e) => setTopicId(Number(e.target.value))}
              >
                {topics?.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.id}. {tp.nameUz}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Savol matni */}
            <div>
              <StepLabel n={2}>Savol matni (lotin)</StepLabel>
              <textarea
                className={cn(
                  "input min-h-24 text-base",
                  dup === "exists" && "ring-2 ring-danger/60",
                  dup === "new" && "ring-2 ring-success/50"
                )}
                value={qLat}
                onChange={(e) => onQLat(e.target.value)}
                placeholder="Savol matnini lotin alifbosida yozing..."
              />

              {/* Takror holati — to'liq banner */}
              {dup !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
                    dup === "checking" && "bg-bg2/60 text-muted",
                    dup === "exists" && "bg-danger/10 text-danger",
                    dup === "new" && "bg-success/10 text-success"
                  )}
                >
                  {dup === "checking" && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}
                  {dup === "exists" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  {dup === "new" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {dup === "checking" && "Tekshirilmoqda..."}
                      {dup === "exists" && "Bu savol bazada bor — qo'shib bo'lmaydi"}
                      {dup === "new" && "Yangi savol — qo'shsa bo'ladi"}
                    </div>
                    {dup === "exists" && dupText && (
                      <div className="truncate text-danger/80">↳ {dupText}</div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Tarjimalar (yig'iladigan) */}
              <button
                type="button"
                onClick={() => setShowTr((v) => !v)}
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
              >
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", showTr && "rotate-180")}
                />
                Tarjimalar (kirill avto · rus tugma bilan)
              </button>
              {showTr && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 grid gap-3 overflow-hidden sm:grid-cols-2"
                >
                  <div>
                    <label className="label text-xs">Кирилл (авто)</label>
                    <textarea
                      className="input min-h-16 text-sm"
                      value={qCyr}
                      onChange={(e) => setQCyr(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Русский</label>
                    <textarea
                      className="input min-h-16 text-sm"
                      value={qRus}
                      onChange={(e) => setQRus(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* 3. Variantlar */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <StepLabel n={3}>Javob variantlari</StepLabel>
                {options.length < 5 && (
                  <button onClick={addOption} type="button" className="btn-ghost text-xs">
                    <Plus className="h-3.5 w-3.5" /> Qo'shish
                  </button>
                )}
              </div>
              <p className="-mt-1 mb-2 text-xs text-muted">
                ✔️ tugmasi bilan to'g'ri javobni belgilang (kamida 2 variant).
              </p>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "rounded-xl border p-2 transition",
                      opt.correct
                        ? "border-success/40 bg-success/5"
                        : "border-line/10 bg-bg2/40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCorrect(i)}
                        title="To'g'ri javob"
                        type="button"
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 transition",
                          opt.correct
                            ? "border-success bg-success text-white"
                            : "border-line/25 text-muted hover:border-success/50"
                        )}
                      >
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </button>
                      <input
                        className="input"
                        value={opt.lat}
                        onChange={(e) => onOptLat(i, e.target.value)}
                        placeholder={`Variant ${i + 1}`}
                      />
                      {options.length > 2 && (
                        <button
                          onClick={() => removeOption(i)}
                          type="button"
                          className="btn-ghost shrink-0 p-2 text-danger"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {showTr && (
                      <div className="mt-1.5 grid grid-cols-2 gap-2 pl-11">
                        <input
                          className="input text-xs"
                          value={opt.cyr}
                          onChange={(e) => setOpt(i, { cyr: e.target.value })}
                          placeholder="кирилл"
                        />
                        <input
                          className="input text-xs"
                          value={opt.rus}
                          onChange={(e) => setOpt(i, { rus: e.target.value })}
                          placeholder="рус"
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* 4. Rasm */}
            <div>
              <StepLabel n={4}>Rasm (ixtiyoriy)</StepLabel>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line/25 bg-bg2/40 p-3 transition hover:border-accent/50">
                <input type="file" accept="image/*" hidden onChange={onImage} />
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent/10">
                    <ImagePlus className="h-6 w-6 text-accent" />
                  </div>
                )}
                <span className="text-sm text-muted">
                  {imageFile ? imageFile.name : "Rasm tanlash uchun bosing"}
                </span>
              </label>
            </div>

            {/* Amallar */}
            <div className="flex flex-wrap items-center gap-2 border-t border-line/10 pt-4">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
                className="btn-primary flex-1 justify-center sm:flex-none"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Saqlash
              </button>
              <button onClick={translateRu} disabled={translating} className="btn-ghost" type="button">
                {translating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Languages className="h-4 w-4" />
                )}
                Rus tarjima
              </button>
              <button onClick={regenCyr} className="btn-ghost" type="button" title="Kirillni yangilash">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.section>

        {/* ============ O'ng: ro'yxat ============ */}
        <motion.section
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="overflow-hidden rounded-3xl border border-line/15 bg-card/70 shadow-glass backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line/10 bg-accent/5 px-5 py-3.5">
            <h2 className="font-bold text-ink">Test bazasi</h2>
            <span className="chip bg-accent/15 text-xs text-accent">
              {list.data?.total ?? 0} ta
            </span>
          </div>

          <div className="space-y-3 p-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-9"
                  placeholder="Qidirish..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <select
                className="input sm:max-w-40"
                value={filterTopic ?? ""}
                onChange={(e) => {
                  setFilterTopic(e.target.value ? Number(e.target.value) : undefined);
                  setPage(1);
                }}
              >
                <option value="">Barcha mavzu</option>
                {topics?.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.id}. {tp.nameUz}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-h-[42vh] space-y-2">
              {list.isLoading ? (
                <div className="py-12 text-center text-muted">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </div>
              ) : list.data?.items.length ? (
                list.data.items.map((q, i) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3) }}
                    className="group flex items-start gap-3 rounded-2xl border border-line/10 bg-bg2/40 p-2.5 transition hover:border-accent/30 hover:bg-bg2/70"
                  >
                    {q.imageUrl ? (
                      <img
                        src={`${API_ORIGIN}${q.imageUrl}`}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-xs font-bold text-accent">
                        {topicName(q.topicId).slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm text-ink">{q.text.uz}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="chip bg-accent/15 text-[11px] text-accent">
                          {topicName(q.topicId)}
                        </span>
                        {langBadges(q).map((l) => (
                          <span
                            key={l}
                            className="chip bg-bg2/80 text-[10px] uppercase text-muted"
                          >
                            {l}
                          </span>
                        ))}
                        <span className="text-[11px] text-muted">{formatDate(q.createdAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(q)}
                      className="btn-ghost shrink-0 p-1.5 text-danger opacity-60 transition group-hover:opacity-100"
                      title="O'chirish"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="py-12 text-center text-sm text-muted">Topilmadi</div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-ghost px-3 py-1 text-sm"
                >
                  ‹
                </button>
                <span className="text-sm text-muted">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-ghost px-3 py-1 text-sm"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </motion.section>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Savolni o'chirish"
        description={deleteTarget?.text.uz}
        danger
        confirmText="Ha"
        cancelText="Yo'q"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
