import { Languages } from "lucide-react";
import { CONTENT_LANGS } from "@/lib/lang";
import { cn } from "@/lib/utils";
import type { ContentLang } from "@/lib/types";

interface Props {
  value: ContentLang;
  onChange: (lang: ContentLang) => void;
  compact?: boolean;
}

export function ContentLangSwitcher({ value, onChange, compact }: Props) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-line/15 bg-bg2/70 p-1">
      {!compact && <Languages className="ml-1.5 h-4 w-4 text-muted" />}
      {CONTENT_LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => onChange(l.code)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            value === l.code
              ? "bg-accent text-white shadow"
              : "text-muted hover:text-ink"
          )}
        >
          {compact ? l.short : l.label}
        </button>
      ))}
    </div>
  );
}
