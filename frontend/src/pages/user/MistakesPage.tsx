import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, ShieldAlert, ShieldX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getErrorMessage, meApi } from "@/lib/api";
import { ActionCard } from "@/components/shared/ActionCard";
import { ConfirmModal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useMeStats } from "@/lib/queries";
import { useUiStore } from "@/store/ui";
import { toast } from "@/components/ui/toast";
import type { UiLang } from "@/lib/types";

const CLEAR_T: Record<UiLang, { btn: string; title: string; desc: string; done: string; yes: string; no: string }> = {
  uz: {
    btn: "Xatolarni tozalash",
    title: "Barcha xatolarni tozalaysizmi?",
    desc: "Barcha xato savollaringiz ro'yxatdan o'chiriladi. Bu amalni qaytarib bo'lmaydi.",
    done: "Xatolar tozalandi",
    yes: "Ha, tozalash",
    no: "Yo'q",
  },
  kr: {
    btn: "Хатоларни тозалаш",
    title: "Барча хатоларни тозалайсизми?",
    desc: "Барча хато саволларингиз рўйхатдан ўчирилади. Бу амални қайтариб бўлмайди.",
    done: "Хатолар тозаланди",
    yes: "Ҳа, тозалаш",
    no: "Йўқ",
  },
  ru: {
    btn: "Очистить ошибки",
    title: "Очистить все ошибки?",
    desc: "Все ваши ошибочные вопросы будут удалены из списка. Это действие необратимо.",
    done: "Ошибки очищены",
    yes: "Да, очистить",
    no: "Нет",
  },
};

export function MistakesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const uiLang = useUiStore((s) => s.uiLang);
  const tt = CLEAR_T[uiLang] ?? CLEAR_T.uz;
  const { data: stats } = useMeStats();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mistakeCount = stats?.mistakes ?? 0;

  const clear = useMutation({
    mutationFn: meApi.clearMistakes,
    onSuccess: () => {
      toast.success(tt.done);
      qc.invalidateQueries({ queryKey: ["meStats"] });
      qc.invalidateQueries({ queryKey: ["mistakes"] });
      qc.invalidateQueries({ queryKey: ["lessonQuestions", "mistakes"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-ink">{t("nav.mistakes")}</h1>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={mistakeCount === 0 || clear.isPending}
          className="btn-ghost border-danger/30 text-danger transition hover:-translate-y-0.5 hover:border-danger/50 hover:bg-danger/10 hover:shadow-glow disabled:opacity-40"
        >
          {clear.isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
          {tt.btn}
          {mistakeCount > 0 && (
            <span className="ml-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-bold text-danger">
              {mistakeCount}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ActionCard
          icon={ShieldAlert}
          title={t("home.allMistakes")}
          subtitle={`${stats?.allMistakesPercent ?? 0}%`}
          onClick={() => navigate("/lesson/mistakes")}
        />
        <ActionCard
          icon={ShieldX}
          title={t("home.myMistakes")}
          subtitle={`${mistakeCount} ${t("lesson.question").toLowerCase()}`}
          onClick={() => navigate("/lesson/mistakes")}
          delay={0.05}
        />
      </div>

      <ConfirmModal
        open={confirmOpen}
        danger
        title={tt.title}
        description={tt.desc}
        confirmText={tt.yes}
        cancelText={tt.no}
        onConfirm={() => {
          setConfirmOpen(false);
          clear.mutate();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
