import {
  Bot,
  CreditCard,
  Info,
  MessageCircle,
  MessageSquare,
  Receipt,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ActionCard } from "@/components/shared/ActionCard";

export function AccountPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const cards: { icon: typeof Bot; title: string; to?: string; url?: string }[] = [
    { icon: CreditCard, title: t("nav.subscribe"), to: "/payment" },
    { icon: Receipt, title: "To'lov tarixi", to: "/payment" },
    { icon: Info, title: "Obuna haqida", to: "/payment" },
    { icon: MessageSquare, title: "Taklif va murojaat uchun" },
    { icon: Bot, title: t("home.testBot"), url: "https://t.me/TayyorPrava_bot" },
    { icon: MessageCircle, title: t("home.qaGroup"), url: "https://t.me/TayyorPrava" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-ink">{t("nav.subscribe")}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c, i) => (
          <ActionCard
            key={c.title}
            icon={c.icon}
            title={c.title}
            delay={i * 0.04}
            onClick={() =>
              c.url
                ? window.open(c.url, "_blank", "noopener,noreferrer")
                : c.to && navigate(c.to)
            }
          />
        ))}
      </div>
    </div>
  );
}
