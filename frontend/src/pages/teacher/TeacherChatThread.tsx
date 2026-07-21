import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, AtSign } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { teacherPanelApi } from "@/lib/api";
import type { ChatSendPayload } from "@/lib/api";
import { initials } from "@/lib/utils";
import { ChatView } from "@/components/chat/ChatView";
import { PageLoader } from "@/components/ui/Spinner";

/** Ustozning bitta user bilan suhbati — o'ng panelni to'liq egallaydi (telegram kabi). */
export function TeacherChatThread() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const threadsQ = useQuery({
    queryKey: ["teacherThreads"],
    queryFn: teacherPanelApi.threads,
  });
  const messagesQ = useQuery({
    queryKey: ["teacherThreadMsgs", threadId],
    queryFn: () => teacherPanelApi.messages(threadId!),
    enabled: !!threadId,
    refetchInterval: 4000,
  });

  const thread = threadsQ.data?.find((t) => t.id === threadId);

  if (messagesQ.isLoading) return <PageLoader />;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["teacherThreadMsgs", threadId] });
    await qc.invalidateQueries({ queryKey: ["teacherThreads"] });
  };

  const send = async (payload: ChatSendPayload) => {
    await teacherPanelApi.reply(threadId!, payload);
    await refresh();
  };
  const edit = async (messageId: string, text: string) => {
    await teacherPanelApi.editMsg(threadId!, messageId, text);
    await refresh();
  };
  const remove = async (messageId: string) => {
    await teacherPanelApi.deleteMsg(threadId!, messageId);
    await refresh();
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <motion.header
        key={threadId}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 border-b border-line/10 bg-card/40 p-3 backdrop-blur"
      >
        {/* Mobil: ro'yxatga qaytish (desktopda sidebar doim ko'rinadi) */}
        <button
          onClick={() => navigate("/teacher")}
          className="btn-ghost h-9 w-9 shrink-0 rounded-full p-0 lg:hidden"
          aria-label="Ro'yxatga qaytish"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark font-bold text-white">
          {initials(thread?.userName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-ink">
            {thread?.userName || "Foydalanuvchi"}
          </div>
          {thread?.userNickname && (
            <div className="flex items-center text-xs text-muted">
              <AtSign className="h-3 w-3" />
              {thread.userNickname}
            </div>
          )}
        </div>
        {thread?.awaitingReply && (
          <span className="chip shrink-0 bg-danger/15 text-danger">javob kutmoqda</span>
        )}
      </motion.header>

      <ChatView
        messages={messagesQ.data ?? []}
        mySide="teacher"
        onSend={send}
        onEdit={edit}
        onDelete={remove}
      />
    </div>
  );
}
