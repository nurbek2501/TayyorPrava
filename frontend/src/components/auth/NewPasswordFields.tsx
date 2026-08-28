import { useState } from "react";
import { Check, Eye, EyeOff, Lock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PASSWORD_RULES, isPasswordValid } from "@/lib/authValidation";
import { cn } from "@/lib/utils";
import { RequirementList } from "./RequirementList";

interface Props {
  password: string;
  onPasswordChange: (v: string) => void;
  confirm: string;
  onConfirmChange: (v: string) => void;
  autoFocus?: boolean;
  label?: string;
}

/** Parol + parolni takrorlash (jonli qoidalar + moslik tekshiruvi). */
export function NewPasswordFields({
  password,
  onPasswordChange,
  confirm,
  onConfirmChange,
  autoFocus,
  label,
}: Props) {
  const { t } = useTranslation();
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const matched =
    confirm.length > 0 && confirm === password && isPasswordValid(password);

  return (
    <>
      <div>
        <label className="label">{label ?? t("auth.password")}</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-10 pr-10"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onFocus={() => setPwFocused(true)}
            onBlur={() => setPwFocused(false)}
            placeholder={t("auth.passwordThink")}
            autoComplete="new-password"
            autoFocus={autoFocus}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink"
            tabIndex={-1}
            aria-label={showPw ? t("auth.hide") : t("auth.show")}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {(pwFocused || password) && (
          <RequirementList rules={PASSWORD_RULES} value={password} />
        )}
      </div>

      <div>
        <label className="label">{t("auth.repeatPassword")}</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className={cn(
              "input pl-10 pr-10",
              mismatch && "ring-1 ring-danger/60",
              matched && "ring-1 ring-success/60"
            )}
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
            placeholder={t("auth.repeatPasswordPh")}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink"
            tabIndex={-1}
            aria-label={showConfirm ? t("auth.hide") : t("auth.show")}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {mismatch && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
            <X className="h-3.5 w-3.5" /> {t("auth.passwordsMismatch")}
          </p>
        )}
        {matched && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success">
            <Check className="h-3.5 w-3.5" /> {t("auth.passwordsMatch")}
          </p>
        )}
      </div>
    </>
  );
}
