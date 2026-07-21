import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Award, GraduationCap } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { teachersApi } from "@/lib/api";
import type { ChatSendPayload } from "@/lib/api";
import { ChatView } from "@/components/chat/ChatView";
import { PageLoader } from "@/components/ui/Spinner";

/** User↔ustoz suhbati — telegram-uslub, har 4 soniyada yangilanadi. */
export function TeacherChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const teachersQ = useQuery({ queryKey: ["teachers"], queryFn: teachersApi.list });
  const chatQ = useQuery({
    queryKey: ["teacherChat", id],
    queryFn: () => teachersApi.chat(id!),
    enabled: !!id,
    refetchInterval: 4000,
  });

  const teacher = teachersQ.data?.find((t) => t.id === id);

  if (chatQ.isLoading) return <PageLoader />;

  const refresh = () => qc.invalidateQueries({ queryKey: ["teacherChat", id] });

  const send = async (payload: ChatSendPayload) => {
    await teachersApi.send(id!, payload);
    await refresh();
  };
  const edit = async (messageId: string, text: string) => {
    await teachersApi.editMsg(id!, messageId, text);
    await refresh();
  };
  const remove = async (messageId: string) => {
    await teachersApi.deleteMsg(id!, messageId);
    await refresh();
  };

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col p-2.5 sm:p-4">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card mb-2.5 flex items-center gap-3 p-2.5 sm:mb-3 sm:p-3"
      >
        <button
          onClick={() => navigate("/teachers")}
          className="btn-ghost h-10 w-10 shrink-0 rounded-full p-0"
          aria-label="Orqaga"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-900 text-white shadow-glow ring-2 ring-accent/30">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-ink">
            {teacher ? `${teacher.name} ${teacher.surname || ""}` : "Ustoz"}
          </div>
          <div className="flex items-center gap-1 truncate text-xs text-muted">
            {teacher && (
              <>
                <Award className="h-3 w-3 shrink-0 text-warning" />
                {teacher.experienceYears} yil tajriba
              </>
            )}
          </div>
        </div>
        {chatQ.data?.accessExpiresAt && (
          <span className="chip hidden shrink-0 bg-success/15 text-success sm:inline-flex">
            {new Date(chatQ.data.accessExpiresAt).toLocaleDateString("ru-RU")} gacha
          </span>
        )}
      </motion.header>

      <div className="glass-card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <ChatView
          messages={chatQ.data?.messages ?? []}
          mySide="user"
          onSend={send}
          onEdit={edit}
          onDelete={remove}
          canSend={chatQ.data?.canSend ?? false}
          disabledNote="Yozish uchun ustoz tarifini sotib oling — Ustozlar bo'limiga qaytib «Murojaat qilish»ni bosing."
        />
      </div>
    </div>
  );
}
