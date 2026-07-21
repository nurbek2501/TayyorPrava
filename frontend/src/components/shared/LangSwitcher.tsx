import { useUiStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import type { ContentLang, UiLang } from "@/lib/types";

// Bitta umumiy til almashtirgich: interfeys tili (uiLang) bilan birga
// savol/kontent tilini (contentLang) ham bir vaqtda almashtiradi.
// Mapping: O'z → uz/uz · Кр → kr/kaa (kirill) · Ру → ru/ru.
const LANGS: { value: UiLang; content: ContentLang; label: string }[] = [
  { value: "uz", content: "uz", label: "O'z" },
  { value: "kr", content: "kaa", label: "Кр" },
  { value: "ru", content: "ru", label: "Ру" },
];

export function LangSwitcher() {
  const { uiLang, setUiLang, setContentLang } = useUiStore();
  const select = (value: UiLang, content: ContentLang) => {
    setUiLang(value);
    setContentLang(content);
  };
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line/15 bg-bg2/60 p-1">
      {LANGS.map(({ value, content, label }) => (
        <button
          key={value}
          onClick={() => select(value, content)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
            uiLang === value ? "bg-accent text-white shadow" : "text-muted hover:text-ink"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
