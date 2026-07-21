import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTopics } from "@/lib/queries";
import { useUiStore } from "@/store/ui";
import { Skeleton } from "@/components/ui/Spinner";
import type { Topic } from "@/lib/types";

function topicName(topic: Topic, lang: string) {
  if (lang === "ru") return topic.nameRu || topic.nameUz;
  if (lang === "kaa") return topic.nameKaa || topic.nameUz;
  return topic.nameUz;
}

/** Ustoz uchun testlar — mavzularga bo'lingan holda (mashq rejimini ochadi). */
export function TeacherTests() {
  const navigate = useNavigate();
  const { data: topics, isLoading } = useTopics();
  const contentLang = useUiStore((s) => s.contentLang);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/teacher")}
          className="btn-ghost h-9 w-9 shrink-0 rounded-full p-0 lg:hidden"
          aria-label="Orqaga"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-extrabold text-ink">Testlar — mavzular bo'yicha</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics?.map((topic, i) => (
            <motion.button
              key={topic.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              onClick={() => navigate(`/lesson/${topic.id}`)}
              className="glass-card glass-hover flex items-center gap-3 p-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-bold text-accent">
                {topic.id}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">
                  {topicName(topic, contentLang)}
                </div>
                <div className="text-xs text-muted">{topic.questionCount} savol</div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
