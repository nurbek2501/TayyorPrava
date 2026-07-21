import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Brain,
  Clock,
  Eye,
  EyeOff,
  Globe,
  GraduationCap,
  Hash,
  KeyRound,
  Lock,
  Percent,
  Phone,
  Radio,
  Repeat,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  UserCog,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authApi, getErrorMessage, settingsApi } from "@/lib/api";
import { useSettings } from "@/lib/queries";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { Toggle } from "@/components/ui/Toggle";
import { cn, formatNumber } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { SiteSettings } from "@/lib/types";

function Section({
  icon: Icon,
  iconClass,
  headerClass,
  title,
  desc,
  delay,
  children,
}: {
  icon: LucideIcon;
  iconClass: string;
  headerClass: string;
  title: string;
  desc?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="overflow-hidden rounded-3xl border border-line/15 bg-card/70 shadow-glass backdrop-blur-xl"
    >
      <div className={cn("flex items-center gap-3 border-b border-line/10 px-5 py-4", headerClass)}>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-ink">{title}</h3>
          {desc && <p className="text-xs text-muted">{desc}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

function NumberField({
  label,
  icon: Icon,
  value,
  onChange,
  min = 0,
  step = 1,
  hint,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted" />
        {label}
      </label>
      <input
        type="number"
        min={min}
        step={step}
        className="input font-semibold"
        value={value}
        onChange={onChange}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function AdminAccountSection() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["adminMe"], queryFn: authApi.adminMe });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      authApi.adminUpdateCredentials({
        currentPassword,
        newLogin: newLogin.trim() || undefined,
        newPassword: newPassword || undefined,
      }),
    onSuccess: (res) => {
      toast.success("Login/parol yangilandi. Keyingi safar yangi ma'lumot bilan kiring.");
      setCurrentPassword("");
      setNewLogin("");
      setNewPassword("");
      setNewPasswordConfirm("");
      qc.setQueryData(["adminMe"], (old: typeof me) =>
        old ? { ...old, login: res.login } : old
      );
      qc.invalidateQueries({ queryKey: ["adminMe"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const trimmedLogin = newLogin.trim();
  const wantsLoginChange = !!trimmedLogin && trimmedLogin !== me?.login;
  const wantsPasswordChange = newPassword.length > 0;
  const passwordsMismatch = wantsPasswordChange && newPassword !== newPasswordConfirm;
  const canSubmit =
    currentPassword.length > 0 &&
    (wantsLoginChange || wantsPasswordChange) &&
    !passwordsMismatch &&
    (!wantsPasswordChange || newPassword.length >= 8);

  return (
    <Section
      icon={UserCog}
      iconClass="bg-fuchsia-500/15 text-fuchsia-500"
      headerClass="bg-fuchsia-500/5"
      title="Mening hisobim"
      desc="Admin login va parolini o'zgartirish — faqat shu hisobga tegadi"
      delay={0.3}
    >
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-line/10 bg-bg2/50 px-4 py-3">
        <span className="text-sm text-muted">Joriy login</span>
        <span className="font-mono font-semibold text-ink">{me?.login ?? "..."}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label flex items-center gap-1.5">
            <UserCog className="h-3.5 w-3.5 text-muted" />
            Yangi login (ixtiyoriy)
          </label>
          <input
            className="input"
            placeholder={me?.login ?? "login"}
            value={newLogin}
            onChange={(e) => setNewLogin(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted" />
            Joriy parol
          </label>
          <input
            type={showPw ? "text" : "password"}
            className="input"
            placeholder="Joriy parolingiz"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted" />
            Yangi parol (ixtiyoriy)
          </label>
          <input
            type={showPw ? "text" : "password"}
            className="input"
            placeholder="Kamida 8 belgi"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted" />
            Yangi parolni tasdiqlash
          </label>
          <input
            type={showPw ? "text" : "password"}
            className={cn("input", passwordsMismatch && "border-danger/60")}
            placeholder="Yangi parolni qayta yozing"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={!wantsPasswordChange}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPw ? "Parollarni yashirish" : "Parollarni ko'rsatish"}
        </button>
        {passwordsMismatch && (
          <p className="text-xs font-medium text-danger">Yangi parollar bir xil emas</p>
        )}
      </div>

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !canSubmit}
        className={cn(
          "btn-primary mt-4 flex items-center gap-2",
          !canSubmit && "opacity-50"
        )}
      >
        {mutation.isPending ? <Spinner /> : <Save className="h-4 w-4" />}
        Login/parolni yangilash
      </button>
    </Section>
  );
}

export function AdminSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useSettings();
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(data);
      setDirty(false);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => settingsApi.update(form ?? {}),
    onSuccess: () => {
      toast.success(t("common.save"));
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading || !form) return <PageLoader />;

  const set = (patch: Partial<SiteSettings>) => {
    setForm({ ...form, ...patch });
    setDirty(true);
  };
  const num =
    (k: keyof SiteSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
      set({ [k]: Number(e.target.value) } as Partial<SiteSettings>);

  const SaveBtn = ({ float }: { float?: boolean }) => (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending || !dirty}
      className={cn(
        "btn-primary flex items-center gap-2",
        float && "shadow-glow",
        !dirty && "opacity-50"
      )}
    >
      {mutation.isPending ? <Spinner /> : <Save className="h-4 w-4" />}
      {t("common.save")}
    </button>
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Sarlavha + saqlash */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-ink">{t("admin.settings")}</h1>
            <p className="text-sm text-muted">
              Sayt, imtihon va aloqa sozlamalari — barchasi bazaga saqlanadi.
            </p>
          </div>
        </div>
        <div className="hidden sm:block">
          <SaveBtn />
        </div>
      </motion.div>

      {/* 1. Umumiy */}
      <Section
        icon={Globe}
        iconClass="bg-accent/15 text-accent"
        headerClass="bg-accent/5"
        title="Umumiy"
        desc="Sayt nomi va standart sozlamalar"
        delay={0.05}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Sayt nomi</label>
            <input
              className="input"
              value={form.siteName}
              onChange={(e) => set({ siteName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Standart til</label>
            <select
              className="input"
              value={form.defaultLang}
              onChange={(e) => set({ defaultLang: e.target.value })}
            >
              <option value="uz">O'zbekcha</option>
              <option value="kaa">Qaraqalpaqsha</option>
              <option value="ru">Русский</option>
            </select>
          </div>
          <div>
            <label className="label">Standart mavzu</label>
            <select
              className="input"
              value={form.defaultTheme}
              onChange={(e) => set({ defaultTheme: e.target.value })}
            >
              <option value="dark">{t("theme.dark")}</option>
              <option value="light">{t("theme.light")}</option>
              <option value="system">{t("theme.system")}</option>
            </select>
          </div>
        </div>
      </Section>

      {/* 2. Mashq imtihoni */}
      <Section
        icon={GraduationCap}
        iconClass="bg-blue-500/15 text-blue-500"
        headerClass="bg-blue-500/5"
        title="Mashq imtihoni"
        desc="«Imtihon topshirish» (mashq) rejimi parametrlari"
        delay={0.1}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField
            icon={Hash}
            label="Savollar soni"
            min={1}
            value={form.examQuestionCount}
            onChange={num("examQuestionCount")}
          />
          <NumberField
            icon={Clock}
            label="Vaqt (daqiqa)"
            min={1}
            value={form.examDurationMin}
            onChange={num("examDurationMin")}
          />
          <NumberField
            icon={ShieldAlert}
            label="Ruxsat etilgan xato"
            value={form.examMaxMistakes}
            onChange={num("examMaxMistakes")}
          />
        </div>
      </Section>

      {/* 3. Real imtihon */}
      <Section
        icon={Radio}
        iconClass="bg-red-500/15 text-red-500"
        headerClass="bg-red-500/5"
        title="Real imtihon"
        desc="Rasmiy real imtihon parametrlari va to'lovi"
        delay={0.15}
      >
        <div
          className={cn(
            "mb-4 flex items-center justify-between gap-3 rounded-2xl border p-4",
            form.realExamLocked
              ? "border-danger/30 bg-danger/5"
              : "border-line/10 bg-bg2/50"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl",
                form.realExamLocked ? "bg-danger/15 text-danger" : "bg-line/10 text-muted"
              )}
            >
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">
                Real imtihon bo'limini qulflash
              </div>
              <p className="text-xs text-muted">
                Yoqilsa — HECH KIM (mavjud to'langan ticket bilan ham) sotib ola
                yoki boshlay olmaydi. Boshqa bo'limlarga ta'sir qilmaydi.
              </p>
            </div>
          </div>
          <Toggle
            checked={form.realExamLocked}
            onChange={(v) => set({ realExamLocked: v })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            icon={Hash}
            label="Savollar soni"
            min={1}
            value={form.realExamQuestionCount}
            onChange={num("realExamQuestionCount")}
          />
          <NumberField
            icon={Clock}
            label="Vaqt (daqiqa)"
            min={1}
            value={form.realExamDurationMin}
            onChange={num("realExamDurationMin")}
          />
          <NumberField
            icon={ShieldAlert}
            label="Ruxsat etilgan xato"
            value={form.realExamMaxMistakes}
            onChange={num("realExamMaxMistakes")}
          />
          <NumberField
            icon={Repeat}
            label="Qayta topshirish — ruxsat etilgan xato"
            value={form.realExamRestoreMaxMistakes}
            onChange={num("realExamRestoreMaxMistakes")}
            hint="Guvohnomadan mahrum bo'lganlar (50 savol) rejimi — mustaqil sozlanadi."
          />
        </div>
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
          <NumberField
            icon={Wallet}
            label="Bir martalik kirish narxi (so'm)"
            min={0}
            step={1000}
            value={form.realExamPrice}
            onChange={num("realExamPrice")}
            hint="Foydalanuvchi real imtihonga har kirganda shu summani to'laydi (0 = bepul)."
          />
          <div className="mt-2 text-sm text-muted">
            Joriy:{" "}
            <b className="text-ink">{formatNumber(form.realExamPrice ?? 0)} so'm</b>
          </div>
        </div>
      </Section>

      {/* 4. Aqlli test (Smart test) */}
      <Section
        icon={Brain}
        iconClass="bg-violet-500/15 text-violet-500"
        headerClass="bg-violet-500/5"
        title="Aqlli test"
        desc="O'zlashtirish ketma-ketligi va tavsiya foizi"
        delay={0.2}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            icon={Repeat}
            label="Ketma-ketlik (necha marta to'g'ri)"
            min={1}
            value={form.smartTestStreak}
            onChange={num("smartTestStreak")}
            hint="Savol shuncha marta KETMA-KET to'g'ri yechilsa — o'zlashtirilgan sanaladi va qayta tushmaydi."
          />
          <NumberField
            icon={Percent}
            label="Tavsiya foizi (%)"
            min={0}
            step={5}
            value={form.smartTestAdvicePercent}
            onChange={num("smartTestAdvicePercent")}
            hint="Bilmagan savollar foizi shu chegaradan PAST bo'lsa — foydalanuvchiga real imtihon tavsiya etiladi."
          />
        </div>
      </Section>

      {/* 5. Aloqa */}
      <Section
        icon={Phone}
        iconClass="bg-emerald-500/15 text-emerald-500"
        headerClass="bg-emerald-500/5"
        title="Aloqa (Landing)"
        desc="Mehmon panelidagi aloqa ma'lumotlari"
        delay={0.25}
      >
        <p className="mb-3 text-xs text-muted">
          Landing matnlari 3 tilda avtomatik, tariflar — «Tariflar» bo'limidan,
          statistika esa bazadan jonli olinadi. Bu yerda faqat aloqa.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Telegram</label>
            <input
              className="input"
              placeholder="@TayyorPrava"
              value={form.landingTelegram ?? ""}
              onChange={(e) => set({ landingTelegram: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input
              className="input"
              placeholder="+998 ..."
              value={form.landingPhone ?? ""}
              onChange={(e) => set({ landingPhone: e.target.value })}
            />
          </div>
        </div>
      </Section>

      {/* 6. Mening hisobim — admin o'z login/parolini o'zgartiradi (mustaqil, sayt sozlamalariga tasir qilmaydi) */}
      <AdminAccountSection />

      {/* Suzuvchi saqlash paneli — o'zgarish bo'lsa (exit'siz: AnimatePresence DOM'da qoldiradi) */}
      {dirty && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line/10 bg-bg/90 p-4 backdrop-blur-xl lg:left-72"
        >
          <span className="text-sm font-medium text-muted">
            Saqlanmagan o'zgarishlar bor
          </span>
          <SaveBtn float />
        </motion.div>
      )}
    </div>
  );
}
