import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, KeyRound, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { assetUrl, authApi, getErrorMessage } from "@/lib/api";
import { isPasswordValid } from "@/lib/authValidation";
import { useAuth } from "@/store/auth";
import { GlassCard } from "@/components/ui/GlassCard";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";
import { NewPasswordFields } from "@/components/auth/NewPasswordFields";
import { cn, initials } from "@/lib/utils";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    telegram: "",
    avatarUrl: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        surname: user.surname ?? "",
        email: user.email ?? "",
        telegram: user.telegram ?? "",
        avatarUrl: user.avatarUrl ?? "",
      });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () => authApi.updateMe(form),
    onSuccess: (data) => {
      setUser(data);
      toast.success(t("profile.saved"));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // ---- Parolni o'zgartirish ----
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const changePw = useMutation({
    mutationFn: () =>
      authApi.changePassword({ oldPassword: oldPw, newPassword: newPw }),
    onSuccess: () => {
      toast.success(t("auth.passwordChanged"));
      setOldPw("");
      setNewPw("");
      setConfPw("");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const pwReady =
    !!oldPw && isPasswordValid(newPw) && newPw === confPw && !changePw.isPending;

  // Rasm tanlanishi bilan DARHOL yuklanadi va bazaga saqlanadi.
  // (Ilgari base64 `data:` URL formaga solinardi — u 512 belgilik ustunga sig'may,
  // Postgres'da saqlanmasdan qolardi.)
  const avatarM = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: (data) => {
      setUser(data);
      setForm((f) => ({ ...f, avatarUrl: data.avatarUrl ?? "" }));
      toast.success(t("profile.photoSaved"));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // bir xil faylni qayta tanlash ham ishlasin
    if (file) avatarM.mutate(file);
  };

  const avatarSrc = assetUrl(form.avatarUrl);

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-extrabold text-ink"
      >
        {t("profile.title")}
      </motion.h1>

      {/* Profil karta */}
      <motion.div {...fadeUp} transition={{ duration: 0.45 }}>
        <GlassCard>
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative"
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-28 w-28 rounded-full object-cover ring-4 ring-accent/20"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-4xl font-bold text-white shadow-glow">
                  {initials(user?.name)}
                </div>
              )}
              <span
                className={cn(
                  "absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-2 border-card",
                  user?.subscriptionActive ? "bg-success" : "bg-muted"
                )}
              />
            </motion.div>
            <div className="flex-1 text-center sm:text-left">
              <div className="text-xl font-bold text-ink">
                {[user?.name, user?.surname].filter(Boolean).join(" ") ||
                  "Foydalanuvchi"}
              </div>
              <p className="mt-1 text-sm text-muted">{t("profile.photoHint")}</p>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarM.isPending}
                  className="btn-ghost"
                >
                  {avatarM.isPending ? <Spinner /> : <Upload className="h-4 w-4" />}
                  {t("profile.uploadPhoto")}
                </button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="btn-primary"
                >
                  {mutation.isPending ? <Spinner /> : <Check className="h-4 w-4" />}
                  {t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Parolni o'zgartirish */}
      <motion.div {...fadeUp} transition={{ duration: 0.45, delay: 0.05 }}>
        <GlassCard>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-extrabold text-ink">
              {t("auth.changePassword")}
            </h2>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pwReady) changePw.mutate();
            }}
          >
            <div>
              <label className="label">{t("auth.oldPassword")}</label>
              <input
                className="input"
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <NewPasswordFields
              label={t("auth.password")}
              password={newPw}
              onPasswordChange={setNewPw}
              confirm={confPw}
              onConfirmChange={setConfPw}
            />
            <button type="submit" className="btn-primary" disabled={!pwReady}>
              {changePw.isPending ? <Spinner /> : t("auth.changePassword")}
            </button>
          </form>
        </GlassCard>
      </motion.div>

    </div>
  );
}
