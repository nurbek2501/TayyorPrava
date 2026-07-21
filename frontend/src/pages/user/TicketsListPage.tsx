import { motion } from "framer-motion";
import { ArrowLeft, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useTickets } from "@/lib/queries";
import { Skeleton } from "@/components/ui/Spinner";

export function TicketsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: tickets, isLoading } = useTickets();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </button>
        <h1 className="text-xl font-bold text-ink">{t("home.byTickets")}</h1>
        <span className="w-20" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tickets?.map((ticket, i) => (
            <motion.button
              key={ticket.number}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              onClick={() => navigate(`/lesson/bilet-${ticket.number}`)}
              className="glass-card glass-hover flex flex-col items-center gap-2 p-5 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white">
                <Ticket className="h-6 w-6" />
              </div>
              <div className="font-bold text-ink">
                {t("home.byTickets").includes("Билет") ? "Билет" : "Bilet"} {ticket.number}
              </div>
              <div className="text-xs text-muted">{ticket.count} savol</div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
