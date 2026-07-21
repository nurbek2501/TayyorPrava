import { useRef } from "react";
import { cn } from "@/lib/utils";

/** 5 katakli kod kiritish — avtomatik o'tadi, paste qo'llab-quvvatlanadi. */
export function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setAt = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const arr = value.split("");
    if (digits === "") {
      arr[i] = "";
      onChange(arr.join("").slice(0, 5));
      return;
    }
    let idx = i;
    for (const c of digits.split("")) {
      if (idx < 5) {
        arr[idx] = c;
        idx++;
      }
    }
    onChange(arr.join("").slice(0, 5));
    refs.current[Math.min(idx, 4)]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 4) {
      refs.current[i + 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" dir="ltr">
      {Array.from({ length: 5 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={value[i] || ""}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => {
            e.preventDefault();
            setAt(0, e.clipboardData.getData("text"));
          }}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete="one-time-code"
          disabled={disabled}
          className={cn(
            "h-14 w-12 rounded-xl border-2 bg-card/40 text-center text-2xl font-bold text-ink outline-none transition-all sm:h-16 sm:w-14",
            "focus:border-accent focus:ring-2 focus:ring-accent/30",
            invalid ? "border-danger/70" : "border-line/25",
            disabled && "opacity-50"
          )}
        />
      ))}
    </div>
  );
}
