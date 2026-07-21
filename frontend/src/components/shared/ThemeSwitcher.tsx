import { Monitor, Moon, Sun } from "lucide-react";
import { useUiStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import type { Theme } from "@/lib/types";

const OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "system", icon: Monitor },
  { value: "dark", icon: Moon },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useUiStore();
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line/15 bg-bg2/60 p-1">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition",
            theme === value
              ? "bg-accent text-white shadow"
              : "text-muted hover:text-ink"
          )}
          title={value}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
