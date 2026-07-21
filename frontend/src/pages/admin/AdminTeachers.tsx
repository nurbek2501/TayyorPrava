import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  AtSign,
  Award,
  FileText,
  GraduationCap,
  Link2,
  Loader2,
  MessagesSquare,
  Phone,
  Plus,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { adminTeachersApi, assetUrl, getErrorMessage } from "@/lib/api";
import type { AdminChatThread, TeacherAdmin } from "@/lib/api";
import { cn, initials } from "@/lib/utils";
import { ChatView } from "@/components/chat/ChatView";
import { ConfirmModal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";

type Tab = "teachers" | "chats" | "flags";

// ---------------- Yangi ustoz qo'shish modali ----------------
function AddTeacherModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    surname: "",
    phone: "",
    telegram: "",
    experienceYears: 1,
    login: "",
    password: "",
    passwordConfirm: "",
  });
  const set = (k: keyof typeof f, v: string | number) => setF((s) => ({ ...s, [k]: v }));

  const create = useMutation({
    mutationFn: () =>
      adminTeachersApi.create({
        ...f,
        telegram: f.telegram || undefined,
        experienceYears: Number(f.experienceYears) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminTeachers"] });
      toast.success("Yangi ustoz profili ochildi");
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const pwMismatch = f.passwordConfirm.length > 0 && f.password !== f.passwordConfirm;
  const valid =
    f.name.trim() &&
    f.surname.trim() &&
    f.phone.trim().length >= 5 &&
    f.login.trim().length >= 4 &&
    f.password.length >= 8 &&
    f.password === f.passwordConfirm;

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-zoom-in relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line/15 bg-card p-6 shadow-glass"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted transition hover:text-ink"
          aria-label="Yopish"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <UserPlus className="h-5 w-5 text-accent" />
          Yangi ustoz qo'shish
        </h2>

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) create.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ism</label>
              <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ismi" />
            </div>
            <div>
              <label className="label">Familiya</label>
              <input className="input" value={f.surname} onChange={(e) => set("surname", e.target.value)} placeholder="Familiyasi" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Telefon raqami</label>
              <input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value.trim())} placeholder="+99890..." />
            </div>
            <div>
              <label className="label">Telegram username</label>
              <input className="input" value={f.telegram} onChange={(e) => set("telegram", e.target.value.trim())} placeholder="@username" />
            </div>
          </div>
          <div>
            <label className="label">Tajribasi (yil)</label>
            <input
              className="input"
              type="number"
              min={0}
              max={60}
              value={f.experienceYears}
              onChange={(e) => set("experienceYears", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Login (kirish uchun)</label>
            <input
              className="input"
              value={f.login}
              onChange={(e) => set("login", e.target.value.trim())}
              placeholder="Kamida 4 belgi, lotin harf/raqam"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Parol</label>
              <input
                className="input"
                type="password"
                value={f.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Kamida 8 belgi"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="label">Parol (takror)</label>
              <input
                className="input"
                type="password"
                value={f.passwordConfirm}
                onChange={(e) => set("passwordConfirm", e.target.value)}
                placeholder="Qayta kiriting"
                autoComplete="new-password"
              />
            </div>
          </div>
          {pwMismatch && <p className="text-xs text-danger">Parollar mos kelmaydi</p>}

          <button type="submit" disabled={!valid || create.isPending} className="btn-primary w-full py-3">
            {create.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                Profil ochish
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------- Ustozlar ro'yxati ----------------
function TeachersTab() {
  const qc = useQueryClient();
  const { data: teachers, isLoading } = useQuery({
    queryKey: ["adminTeachers"],
    queryFn: adminTeachersApi.list,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<TeacherAdmin | null>(null);
  const [tariffFor, setTariffFor] = useState<string | null>(null);
  const [days, setDays] = useState(1);
  const [price, setPrice] = useState(10000);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["adminTeachers"] });

  const del = useMutation({
    mutationFn: (id: string) => adminTeachersApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Ustoz dasturdan chiqarildi");
      setDeleting(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addTariff = useMutation({
    mutationFn: (teacherId: string) => adminTeachersApi.addTariff(teacherId, { days, price }),
    onSuccess: () => {
      invalidate();
      toast.success("Tarif qo'shildi");
      setTariffFor(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const delTariff = useMutation({
    mutationFn: (v: { teacherId: string; tariffId: string }) =>
      adminTeachersApi.removeTariff(v.teacherId, v.tariffId),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Jami {teachers?.length ?? 0} ta ustoz</p>
        <button onClick={() => setAddOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Yangi ustoz
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !teachers?.length ? (
        <div className="glass-card p-10 text-center text-muted">
          Hozircha ustozlar yo'q — «Yangi ustoz» tugmasi bilan qo'shing.
        </div>
      ) : (
        <div className="space-y-3">
          {teachers.map((tch) => (
            <div key={tch.id} className="glass-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-blue-900 font-bold text-white shadow-glow">
                    {initials(tch.name)}
                  </div>
                  <div>
                    <div className="font-bold text-ink">
                      {tch.name} {tch.surname || ""}
                      {!tch.isActive && (
                        <span className="chip ml-2 bg-danger/15 text-danger">nofaol</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {tch.phone}
                      </span>
                      {tch.telegram && (
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" /> {tch.telegram}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <AtSign className="h-3 w-3" /> {tch.nickname}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3 text-warning" /> {tch.experienceYears} yil
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDeleting(tch)}
                  className="btn-ghost p-2 text-danger"
                  title="Dasturdan chiqarish"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Tariflar: N kun = X so'm */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {tch.tariffs.map((t) => (
                  <span key={t.id} className="chip bg-bg2/70 text-ink">
                    {t.days} kun · {t.price.toLocaleString("ru-RU")} so'm
                    <button
                      onClick={() => delTariff.mutate({ teacherId: tch.id, tariffId: t.id })}
                      className="ml-1 text-muted transition hover:text-danger"
                      aria-label="Tarifni o'chirish"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {tariffFor === tch.id ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                      className="input h-8 w-16 px-2 py-1 text-xs"
                      placeholder="kun"
                    />
                    <span className="text-xs text-muted">kun =</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="input h-8 w-24 px-2 py-1 text-xs"
                      placeholder="so'm"
                    />
                    <button
                      onClick={() => addTariff.mutate(tch.id)}
                      disabled={addTariff.isPending || days < 1}
                      className="btn-primary h-8 px-2.5 py-0 text-xs"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setTariffFor(null)}
                      className="btn-ghost h-8 px-2 py-0 text-xs"
                    >
                      Bekor
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setTariffFor(tch.id)}
                    className="chip border border-dashed border-line/30 bg-transparent text-muted transition hover:border-accent hover:text-accent"
                  >
                    <Plus className="h-3 w-3" />
                    Tarif qo'shish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && <AddTeacherModal onClose={() => setAddOpen(false)} />}
      <ConfirmModal
        open={!!deleting}
        danger
        title={`«${deleting?.name} ${deleting?.surname || ""}» ustozni dasturdan chiqarasizmi? Suhbatlari ham o'chadi.`}
        confirmText="Ha, chiqarish"
        cancelText="Bekor qilish"
        onConfirm={() => deleting && del.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

// ---------------- Chatlar (moderatsiya) — telegram-uslub ikki panel ----------------
function ChatsTab() {
  const { data: threads, isLoading } = useQuery({
    queryKey: ["adminTeacherChats"],
    queryFn: adminTeachersApi.chats,
    refetchInterval: 8000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: AdminChatThread | null =
    threads?.find((t) => t.id === selectedId) ?? null;
  const messagesQ = useQuery({
    queryKey: ["adminTeacherChatMsgs", selectedId],
    queryFn: () => adminTeachersApi.chatMessages(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 6000,
  });

  return (
    <div className="glass-card flex h-[calc(100dvh-230px)] min-h-[540px] overflow-hidden p-0 lg:h-[calc(100dvh-190px)]">
      {/* Chap panel — suhbatlar ro'yxati (mobilda suhbat ochilganda yashirinadi) */}
      <aside
        className={cn(
          "w-full flex-col overflow-y-auto border-r border-line/10 lg:flex lg:w-80 xl:w-96",
          selected ? "hidden lg:flex" : "flex"
        )}
      >
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !threads?.length ? (
          <p className="p-8 text-center text-sm text-muted">Hozircha suhbatlar yo'q.</p>
        ) : (
          threads.map((th, i) => (
            <motion.button
              key={th.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              onClick={() => setSelectedId(th.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-line/5 p-3 text-left transition-colors",
                selectedId === th.id
                  ? "bg-accent/15 ring-1 ring-inset ring-accent/25"
                  : "hover:bg-card/70"
              )}
            >
              <div className="relative shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark font-bold text-white">
                  {initials(th.userName)}
                </div>
                {th.flaggedCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-white ring-2 ring-card">
                    {th.flaggedCount}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">
                    {th.userName}
                  </span>
                  {th.lastMsgAt && (
                    <span className="shrink-0 text-[10px] text-muted">
                      {new Date(th.lastMsgAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-accent">↔ {th.teacherName}</div>
                <div className="truncate text-xs text-muted">{th.lastText || "—"}</div>
              </div>
            </motion.button>
          ))
        )}
      </aside>

      {/* O'ng panel — yozishma (telegram kabi shu yerning o'zida ochiladi) */}
      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          selected ? "flex" : "hidden lg:flex"
        )}
      >
        {selected ? (
          <>
            <motion.header
              key={selected.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 border-b border-line/10 bg-card/40 p-3 backdrop-blur"
            >
              <button
                onClick={() => setSelectedId(null)}
                className="btn-ghost h-9 w-9 shrink-0 rounded-full p-0 lg:hidden"
                aria-label="Ro'yxatga qaytish"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-sm font-bold text-white">
                {initials(selected.userName)}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate">
                  <b className="text-ink">{selected.userName}</b>
                  {selected.userNickname && (
                    <span className="text-xs text-muted"> @{selected.userNickname}</span>
                  )}
                </div>
                <div className="truncate text-xs text-accent">
                  ↔ {selected.teacherName} (ustoz)
                </div>
              </div>
              {selected.flaggedCount > 0 && (
                <span className="chip shrink-0 bg-warning/15 text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {selected.flaggedCount} shubhali
                </span>
              )}
            </motion.header>
            {/* Faqat o'qish — admin suhbatga aralashmaydi; o'chirilganlar ham ko'rinadi */}
            <ChatView messages={messagesQ.data ?? []} mySide="teacher" adminView />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/10 text-accent"
            >
              <MessagesSquare className="h-8 w-8" />
            </motion.div>
            <p className="max-w-xs text-sm text-muted">
              Chap ro'yxatdan suhbatni tanlang — yozishma shu yerda ochiladi.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------- Ogohlantirishlar (shubhali xabarlar) ----------------
function FlagsTab() {
  const qc = useQueryClient();
  const { data: flags, isLoading } = useQuery({
    queryKey: ["adminTeacherFlags"],
    queryFn: adminTeachersApi.flags,
    refetchInterval: 10000,
  });

  // Admin ogohlantirishni o'zi o'chiradi (ko'rib chiqildi) — ro'yxatdan yo'qoladi
  const dismiss = useMutation({
    mutationFn: (id: string) => adminTeachersApi.dismissFlag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminTeacherFlags"] });
      qc.invalidateQueries({ queryKey: ["adminTeacherChats"] });
      toast.success("Ogohlantirish o'chirildi");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Havola, <b className="text-ink">telefon raqami</b>, fayl yoki rasm yuborilgan xabarlar shu
        yerda ogohlantirish sifatida chiqadi — kim yuborgani (user yoki ustoz) bilan birga.
        Ko'rib chiqqach, har birini o'chirib tashlashingiz mumkin.
      </p>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !flags?.length ? (
        <div className="glass-card p-10 text-center text-muted">
          Shubhali xabarlar yo'q — hammasi toza ✅
        </div>
      ) : (
        flags.map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card border-warning/30 p-4 ring-1 ring-warning/10"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <b className="text-ink">{f.senderName}</b>
              <span
                className={cn(
                  "chip",
                  f.sender === "teacher"
                    ? "bg-accent/15 text-accent"
                    : "bg-bg2/70 text-muted"
                )}
              >
                {f.sender === "teacher" ? "ustoz" : "user"}
              </span>
              {f.hasPhone && (
                <span className="chip bg-danger/15 text-danger">
                  <Phone className="h-3 w-3" />
                  telefon raqami
                </span>
              )}
              {f.hasLink && (
                <span className="chip bg-warning/15 text-warning">
                  <Link2 className="h-3 w-3" />
                  havola
                </span>
              )}
              {f.attachmentType === "image" && (
                <span className="chip bg-warning/15 text-warning">rasm</span>
              )}
              {f.attachmentType === "file" && (
                <span className="chip bg-warning/15 text-warning">fayl</span>
              )}
              <span className="ml-auto text-[11px] text-muted">
                {new Date(f.createdAt).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {f.text && (
              <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-bg2/50 p-3 text-sm text-ink/90">
                {f.text}
              </p>
            )}
            {f.attachmentUrl && f.attachmentType === "image" && (
              <a href={assetUrl(f.attachmentUrl)} target="_blank" rel="noopener noreferrer">
                <img
                  src={assetUrl(f.attachmentUrl)}
                  alt={f.attachmentName || ""}
                  className="mt-2 max-h-48 rounded-xl object-contain"
                />
              </a>
            )}
            {f.attachmentUrl && f.attachmentType === "file" && (
              <a
                href={assetUrl(f.attachmentUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-fit items-center gap-2 rounded-xl bg-bg2/70 px-3 py-2 text-sm text-ink transition hover:text-accent"
              >
                <FileText className="h-4 w-4" />
                {f.attachmentName || "Fayl"}
              </a>
            )}

            {/* Admin ogohlantirishni o'zi o'chiradi */}
            <div className="mt-3 flex justify-end border-t border-line/10 pt-3">
              <button
                onClick={() => dismiss.mutate(f.id)}
                disabled={dismiss.isPending}
                className="flex items-center gap-1.5 rounded-xl border border-danger/20 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-50"
              >
                {dismiss.isPending && dismiss.variables === f.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                O'chirish
              </button>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

// ---------------- Asosiy sahifa ----------------
export function AdminTeachers() {
  const [tab, setTab] = useState<Tab>("teachers");
  const { data: flags } = useQuery({
    queryKey: ["adminTeacherFlags"],
    queryFn: adminTeachersApi.flags,
    refetchInterval: 15000,
  });

  const tabs: { key: Tab; label: string; icon: typeof GraduationCap; badge?: number }[] = [
    { key: "teachers", label: "Ustozlar", icon: GraduationCap },
    { key: "chats", label: "Chatlar", icon: MessagesSquare },
    { key: "flags", label: "Ogohlantirishlar", icon: AlertTriangle, badge: flags?.length },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-ink">Ustozlar bo'limi</h1>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              tab === t.key
                ? "bg-accent text-white shadow-glow"
                : "bg-card/60 text-muted hover:text-ink"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {!!t.badge && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-bold",
                  tab === t.key ? "bg-white/25 text-white" : "bg-warning/20 text-warning"
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "teachers" && <TeachersTab />}
      {tab === "chats" && <ChatsTab />}
      {tab === "flags" && <FlagsTab />}
    </div>
  );
}
