import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { assetUrl, teachersApi } from "@/lib/api";
import type { AdminChatMsg, ChatMsg, ChatSendPayload } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";

/* ============================= Yordamchilar ============================= */

/** Nomzod matndan XAVFSIZ http(s) havola yasaydi; aks holda null (oddiy matn qoladi).
 *  Sxema qat'iy tekshiriladi (new URL) — faqat http/https; javascript:/data: va h.k. rad. */
function safeHref(candidate: string): string | null {
  const raw = candidate.startsWith("www.") ? `https://${candidate}` : candidate;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Matn ichidagi havolalarni bosiladigan qiladi (telegram kabi). */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+|www\.\S+)/g);
  return (
    <>
      {parts.map((p, i) => {
        const href = /^(https?:\/\/|www\.)/.test(p) ? safeHref(p) : null;
        return href ? (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all font-medium underline underline-offset-2 opacity-95 transition hover:opacity-100"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

/* ============================ Kontekst-menyu ============================ */

interface MenuState {
  msg: ChatMsg;
  x: number;
  y: number;
  mine: boolean;
}

const MENU_W = 200;

function ContextMenu({
  menu,
  canManage,
  canSend,
  onCopy,
  onEdit,
  onDelete,
  onClose,
}: {
  menu: MenuState;
  canManage: boolean;
  canSend: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // Tahrirlash faqat yozish paneli ochiq (canSend) bo'lganda — aks holda input DOM'da
  // yo'q va tahrir rejimidan chiqib bo'lmasdi (UI qamalib qolardi).
  const showEdit = canManage && canSend && menu.mine && !!menu.msg.text;
  const showDelete = canManage && menu.mine;
  const items = [
    menu.msg.text && { icon: Copy, label: "Nusxalash", onClick: onCopy },
    showEdit && { icon: Pencil, label: "Tahrirlash", onClick: onEdit },
    showDelete && { icon: Trash2, label: "O'chirish", onClick: onDelete, danger: true },
  ].filter(Boolean) as {
    icon: typeof Copy;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }[];

  if (!items.length) return null;

  // Ekrandan chiqib ketmasin (telegram kabi bosilgan nuqtaga yopishadi)
  const H = items.length * 44 + 12;
  const x = Math.max(8, Math.min(menu.x, window.innerWidth - MENU_W - 8));
  const y = Math.max(8, Math.min(menu.y, window.innerHeight - H - 8));
  const originX = menu.x > window.innerWidth - MENU_W - 8 ? "right" : "left";
  const originY = menu.y > window.innerHeight - H - 8 ? "bottom" : "top";

  return (
    <div
      className="fixed inset-0 z-[300]"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 480, damping: 30 }}
        style={{ left: x, top: y, width: MENU_W, transformOrigin: `${originY} ${originX}` }}
        className="absolute overflow-hidden rounded-2xl border border-line/15 bg-card/95 p-1.5 shadow-glass backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => {
              it.onClick();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              it.danger
                ? "text-danger hover:bg-danger/10"
                : "text-ink hover:bg-accent/10 hover:text-accent"
            )}
          >
            <it.icon className="h-4 w-4 shrink-0" />
            {it.label}
          </button>
        ))}
      </motion.div>
    </div>
  );
}

/* ============================== Pufakcha ============================== */

function Bubble({
  msg,
  mine,
  adminView,
  onOpenMenu,
}: {
  msg: ChatMsg & Partial<AdminChatMsg>;
  mine: boolean;
  adminView?: boolean;
  onOpenMenu?: (e: { x: number; y: number }, msg: ChatMsg) => void;
}) {
  const pressTimer = useRef<number | null>(null);
  const deleted = !!msg.deletedAt;

  const startPress = (x: number, y: number) => {
    if (!onOpenMenu || deleted) return;
    pressTimer.current = window.setTimeout(() => onOpenMenu({ x, y }, msg), 420);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onContextMenu={(e) => {
          if (!onOpenMenu || deleted) return;
          e.preventDefault();
          onOpenMenu({ x: e.clientX, y: e.clientY }, msg);
        }}
        onTouchStart={(e) =>
          startPress(e.touches[0]?.clientX ?? 0, e.touches[0]?.clientY ?? 0)
        }
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        className={cn(
          "group relative max-w-[86%] select-none rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[70%] sm:select-text",
          mine
            ? "rounded-br-md bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow"
            : "rounded-bl-md border border-line/10 bg-card/90 text-ink shadow-sm backdrop-blur",
          deleted && "opacity-50 ring-1 ring-danger/40"
        )}
      >
        {adminView && (msg.flagged || deleted) && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {deleted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-bold text-danger">
                <Ban className="h-3 w-3" /> o'chirilgan
              </span>
            )}
            {msg.flagged && !deleted && (
              <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning">
                shubhali
              </span>
            )}
          </div>
        )}

        {msg.attachmentUrl && msg.attachmentType === "image" && (
          <a
            href={assetUrl(msg.attachmentUrl)}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
          >
            <img
              src={assetUrl(msg.attachmentUrl)}
              alt={msg.attachmentName || ""}
              draggable={false}
              className="mb-1.5 max-h-64 w-full rounded-xl object-contain"
            />
          </a>
        )}
        {msg.attachmentUrl && msg.attachmentType !== "image" && (
          <a
            href={assetUrl(msg.attachmentUrl)}
            target="_blank"
            rel="noopener noreferrer"
            download={msg.attachmentName || undefined}
            className={cn(
              "mb-1.5 flex items-center gap-2.5 rounded-xl p-2.5 transition",
              mine ? "bg-white/15 hover:bg-white/25" : "bg-bg2/70 hover:bg-bg2"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                mine ? "bg-white/20" : "bg-accent/15 text-accent"
              )}
            >
              <FileText className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
              {msg.attachmentName || "Fayl"}
            </span>
          </a>
        )}

        {msg.text && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            <Linkify text={msg.text} />
          </p>
        )}

        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            mine ? "text-white/70" : "text-muted"
          )}
        >
          {msg.editedAt && <span className="italic">tahrirlangan ·</span>}
          {timeOf(msg.createdAt)}
        </div>
      </motion.div>
    </div>
  );
}

/* =============================== ChatView =============================== */

/**
 * Telegram-uslub chat.
 * - O'ng klik (kompyuter) yoki bosib turish (telefon) → kontekst-menyu:
 *   nusxalash / tahrirlash / o'chirish (faqat o'z xabari).
 * - onSend berilmasa — faqat o'qish (admin moderatsiyasi, adminView bilan).
 */
export function ChatView({
  messages,
  mySide,
  onSend,
  onEdit,
  onDelete,
  canSend = true,
  disabledNote,
  adminView = false,
}: {
  messages: (ChatMsg & Partial<AdminChatMsg>)[];
  mySide: "user" | "teacher";
  onSend?: (payload: ChatSendPayload) => Promise<void>;
  onEdit?: (messageId: string, text: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  canSend?: boolean;
  disabledNote?: string;
  adminView?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attach, setAttach] = useState<{
    url: string;
    name: string;
    type: "image" | "file";
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editing, setEditing] = useState<ChatMsg | null>(null);
  const [deleting, setDeleting] = useState<ChatMsg | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastCountRef = useRef(0);

  const canManage = Boolean(onEdit || onDelete);

  // Yangi xabarda pastga sirg'alish
  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  // Tahrirlanayotgan xabar ro'yxatdan yo'qolsa/o'chirilsa (masalan boshqa sessiyada) —
  // "sharpa" tahrir strip'i qolmasin: tahrir rejimini avtomatik bekor qilamiz.
  useEffect(() => {
    if (editing && !messages.some((m) => m.id === editing.id && !m.deletedAt)) {
      setEditing(null);
      setText("");
    }
  }, [messages, editing]);

  const openMenu = useCallback(
    (pos: { x: number; y: number }, msg: ChatMsg) => {
      setMenu({ msg, x: pos.x, y: pos.y, mine: msg.sender === mySide });
    },
    [mySide]
  );

  const startEdit = (msg: ChatMsg) => {
    setEditing(msg);
    setAttach(null);
    setText(msg.text || "");
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };
  const cancelEdit = () => {
    setEditing(null);
    setText("");
  };

  const copyText = async (msg: ChatMsg) => {
    try {
      await navigator.clipboard.writeText(msg.text || "");
      toast.success("Nusxalandi");
    } catch {
      toast.error("Nusxalab bo'lmadi");
    }
  };

  const pickFile = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      const res = await teachersApi.upload(f);
      setAttach(res);
    } catch {
      toast.error("Faylni yuklab bo'lmadi");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (sending) return;
    const trimmed = text.trim();

    if (editing) {
      if (!onEdit || !trimmed || trimmed === editing.text) return cancelEdit();
      setSending(true);
      try {
        await onEdit(editing.id, trimmed);
        cancelEdit();
      } catch {
        toast.error("Tahrirlab bo'lmadi");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!onSend || (!trimmed && !attach)) return;
    setSending(true);
    try {
      await onSend({
        text: trimmed || undefined,
        attachmentUrl: attach?.url,
        attachmentName: attach?.name,
        attachmentType: attach?.type,
      });
      setText("");
      setAttach(null);
    } catch {
      toast.error("Xabar yuborilmadi");
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    if (!onDelete || !deleting) return;
    const id = deleting.id;
    setDeleting(null);
    try {
      await onDelete(id);
      if (editing?.id === id) cancelEdit();
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  let lastDay = "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Xabarlar */}
      <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 sm:p-4">
        {messages.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center text-sm text-muted"
          >
            Hozircha xabarlar yo'q — birinchi savolingizni yozing.
          </motion.p>
        )}
        {messages.map((m) => {
          const day = dayOf(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id} className="space-y-2">
              {showDay && (
                <div className="sticky top-1 z-10 flex justify-center">
                  <span className="rounded-full border border-line/10 bg-bg2/90 px-3 py-1 text-[11px] font-semibold text-muted shadow-sm backdrop-blur">
                    {day}
                  </span>
                </div>
              )}
              <Bubble
                msg={m}
                mine={m.sender === mySide}
                adminView={adminView}
                onOpenMenu={canManage || m.text ? openMenu : undefined}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Yuborish paneli */}
      {onSend && (
        <div className="border-t border-line/10 bg-card/40 p-2.5 backdrop-blur sm:p-3">
          {!canSend ? (
            <p className="py-1.5 text-center text-sm text-muted">
              {disabledNote || "Yozish uchun tarif sotib oling"}
            </p>
          ) : (
            <>
              {/* Tahrirlash strip'i (telegram kabi input ustida) */}
              {editing && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-2 flex items-center gap-2.5 rounded-xl border-l-4 border-accent bg-accent/10 px-3 py-2"
                >
                  <Pencil className="h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-accent">Tahrirlash</div>
                    <div className="truncate text-xs text-muted">{editing.text}</div>
                  </div>
                  <button
                    onClick={cancelEdit}
                    className="shrink-0 text-muted transition hover:text-danger"
                    aria-label="Tahrirlashni bekor qilish"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )}

              {/* Biriktirma preview */}
              {attach && !editing && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-2 flex items-center gap-2 rounded-xl bg-bg2/70 px-3 py-2 text-sm text-ink"
                >
                  {attach.type === "image" ? (
                    <ImageIcon className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-accent" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{attach.name}</span>
                  <button
                    onClick={() => setAttach(null)}
                    className="text-muted transition hover:text-danger"
                    aria-label="Biriktirmani olib tashlash"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )}

              <div className="flex items-end gap-1.5 sm:gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp,.pdf,.doc,.docx,.txt,.xls,.xlsx,.zip"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                {!editing && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || sending}
                    className="btn-ghost h-11 w-11 shrink-0 rounded-full p-0 transition-transform hover:scale-110"
                    title="Rasm yoki fayl biriktirish"
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Paperclip className="h-5 w-5" />
                    )}
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                    if (e.key === "Escape" && editing) cancelEdit();
                  }}
                  rows={1}
                  placeholder={editing ? "Yangi matn..." : "Xabar yozing..."}
                  className="input max-h-32 min-h-[44px] flex-1 resize-none py-2.5"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => void submit()}
                  disabled={
                    sending || uploading || (editing ? !text.trim() : !text.trim() && !attach)
                  }
                  className="btn-primary h-11 w-11 shrink-0 rounded-full p-0 shadow-glow"
                  aria-label={editing ? "Saqlash" : "Yuborish"}
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : editing ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </motion.button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Kontekst-menyu (o'ng klik / bosib turish) */}
      {menu && (
        <ContextMenu
          menu={menu}
          canManage={canManage}
          canSend={canSend}
          onCopy={() => void copyText(menu.msg)}
          onEdit={() => startEdit(menu.msg)}
          onDelete={() => setDeleting(menu.msg)}
          onClose={() => setMenu(null)}
        />
      )}

      {/* O'chirish tasdig'i */}
      <ConfirmModal
        open={!!deleting}
        danger
        title="Xabarni o'chirasizmi?"
        confirmText="Ha, o'chirish"
        cancelText="Bekor qilish"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
