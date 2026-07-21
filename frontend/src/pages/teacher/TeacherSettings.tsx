import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, AtSign, KeyRound, Loader2, Lock, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authApi, getErrorMessage, teacherPanelApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";

/** Ustoz sozlamalari: login (nik) va parolni o'zgartirish. */
export function TeacherSettings() {
  const navigate = useNavigate();
  // Login o'zgartirish
  const [newLogin, setNewLogin] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const loginMut = useMutation({
    mutationFn: () => teacherPanelApi.changeLogin(newLogin.trim(), loginPw),
    onSuccess: (d) => {
      toast.success(`Login o'zgartirildi: ${d.login}`);
      setNewLogin("");
      setLoginPw("");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Parol o'zgartirish
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const pwMut = useMutation({
    mutationFn: () => authApi.changePassword({ oldPassword: oldPw, newPassword: newPw }),
    onSuccess: () => {
      toast.success("Parol muvaffaqiyatli o'zgartirildi");
      setOldPw("");
      setNewPw("");
      setNewPw2("");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const pwMismatch = newPw2.length > 0 && newPw !== newPw2;

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
        <h1 className="text-xl font-extrabold text-ink">Sozlamalar</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
      <div className="glass-card p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <AtSign className="h-5 w-5 text-accent" />
          Loginni o'zgartirish
        </h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newLogin.trim().length >= 4 && loginPw) loginMut.mutate();
          }}
        >
          <div>
            <label className="label">Yangi login</label>
            <input
              className="input"
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value.trim())}
              placeholder="Yangi login (kamida 4 belgi)"
            />
          </div>
          <div>
            <label className="label">Joriy parol (tasdiqlash uchun)</label>
            <input
              className="input"
              type="password"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              placeholder="Parolingiz"
            />
          </div>
          <button
            type="submit"
            disabled={newLogin.trim().length < 4 || !loginPw || loginMut.isPending}
            className="btn-primary w-full"
          >
            {loginMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Saqlash
              </>
            )}
          </button>
        </form>
      </div>

      <div className="glass-card p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <KeyRound className="h-5 w-5 text-accent" />
          Parolni o'zgartirish
        </h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (oldPw && newPw.length >= 8 && newPw === newPw2) pwMut.mutate();
          }}
        >
          <div>
            <label className="label">Joriy parol</label>
            <input
              className="input"
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              placeholder="Joriy parolingiz"
            />
          </div>
          <div>
            <label className="label">Yangi parol</label>
            <input
              className="input"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Kamida 8 belgi"
            />
          </div>
          <div>
            <label className="label">Yangi parolni takrorlang</label>
            <input
              className="input"
              type="password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              placeholder="Qayta kiriting"
            />
            {pwMismatch && (
              <p className="mt-1 text-xs text-danger">Parollar mos kelmaydi</p>
            )}
          </div>
          <button
            type="submit"
            disabled={!oldPw || newPw.length < 8 || newPw !== newPw2 || pwMut.isPending}
            className="btn-primary w-full"
          >
            {pwMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Parolni yangilash
              </>
            )}
          </button>
        </form>
      </div>
      </div>
      </div>
    </div>
  );
}
