import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AtSign,
  GraduationCap,
  ListChecks,
  LogOut,
  MessagesSquare,
  Settings,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { assetUrl, teacherPanelApi } from "@/lib/api";
import { useNewMessageNotify } from "@/lib/useChatNotify";
import { Logo } from "@/components/shared/Logo";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { useAuth } from "@/store/auth";
import { cn, initials } from "@/lib/utils";

const FOOTER_NAV = [
  { to: "/teacher/tests", label: "Testlar", icon: ListChecks },
  { to: "/teacher/settings", label: "Sozlamalar", icon: Settings },
];

/** O'ng panel bo'sh holati — suhbat tanlanmaganda (faqat desktop ko'rinadi). */
export function TeacherEmpty() {
  return (
    <div className="relative flex h-full flex-1 flex-col items-center justify-center gap-5 overflow-hidden p-8 text-center">
      <div className="animate-blob-drift pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow"
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-[2rem] bg-accent/30" />
        <MessagesSquare className="relative h-11 w-11" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-lg font-bold text-ink">Suhbatni tanlang</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
          Chapdagi ro'yxatdan foydalanuvchini tanlang — yozishma shu yerda ochiladi.
        </p>
      </motion.div>
    </div>
  );
}

/**
 * Ustoz paneli — telegram-uslub: chapda suhbatlar sidebar'i (navbat bilan),
 * o'ngda tanlangan chat / testlar / sozlamalar. Mobilda: ro'yxat ↔ sahifa almashadi.
 */
export function TeacherLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logoutUser);

  const { data: threads } = useQuery({
    queryKey: ["teacherThreads"],
    queryFn: teacherPanelApi.threads,
    refetchInterval: 5000,
    // Brauzer tab fon rejimida (boshqa tab/oyna faol) bo'lsa ham davom etadi —
    // aks holda navbat holati va yangi xabar bildirishnomasi to'xtab qoladi.
    refetchIntervalInBackground: true,
  });
  // User yangi xabar yozganda qisqa signal (ovoz + toast) — allaqachon so'ralib
  // turgan `threads`ni kuzatadi, alohida so'rov qo'shmaydi.
  useNewMessageNotify(threads);
  const waitingCount = threads?.filter((t) => t.awaitingReply).length ?? 0;
  // /teacher dan boshqa yo'lda — mobilda sidebar yashirinib, o'ng panel ochiladi
  const rightActive = location.pathname !== "/teacher";

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* ================= Sidebar (telegram dialoglar ro'yxati) ================= */}
      <aside
        className={cn(
          "w-full flex-col border-r border-line/10 bg-card/50 backdrop-blur-xl lg:flex lg:w-80 xl:w-[380px]",
          rightActive ? "hidden lg:flex" : "flex"
        )}
      >
        {/* Sarlavha — logo + animatsion "Ustoz" belgisi + yengil nur */}
        <div className="relative flex items-center justify-between gap-2 overflow-hidden border-b border-line/10 p-3">
          <div className="animate-blob-drift pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-accent/20 blur-2xl" />
          <Logo />
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="chip relative bg-accent/15 text-accent"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Ustoz
          </motion.span>
        </div>

        {/* Javob kutayotganlar banneri (faqat mavjud bo'lsa — kirish animatsiyasi) */}
        {waitingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 border-b border-line/10 bg-danger/5 px-4 py-2"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
            </span>
            <span className="text-xs font-semibold text-danger">
              {waitingCount} ta foydalanuvchi javob kutmoqda
            </span>
          </motion.div>
        )}

        {/* Suhbatlar — javob kutayotganlar tepada (eng eski birinchi) */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!threads?.length ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 p-8 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <MessagesSquare className="h-7 w-7" />
              </div>
              <p className="text-sm text-muted">
                Hozircha sizga yozgan foydalanuvchilar yo'q.
              </p>
            </motion.div>
          ) : (
            threads.map((th, i) => (
              <motion.div
                key={th.id}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.035, 0.35), type: "spring", stiffness: 260, damping: 24 }}
              >
                <NavLink
                  to={`/teacher/chat/${th.id}`}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex w-full items-center gap-3 border-b border-line/5 p-3 text-left transition-all duration-200",
                      isActive
                        ? "bg-accent/15"
                        : "hover:translate-x-0.5 hover:bg-card/70"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Aktiv suhbatning chap chekka nuri (silliq siljiydi) */}
                      {isActive && (
                        <motion.span
                          layoutId="teacher-thread-active"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-gradient-to-b from-accent to-accent-dark"
                        />
                      )}
                      <div className="relative shrink-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark font-bold text-white transition-transform duration-200 group-hover:scale-105">
                          {initials(th.userName)}
                        </div>
                        {th.awaitingReply && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-danger ring-2 ring-card" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-ink">
                            {th.userName}
                          </span>
                          {th.lastMsgAt && (
                            <span className="shrink-0 text-[10px] text-muted">
                              {new Date(th.lastMsgAt).toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                        {th.userNickname && (
                          <div className="flex items-center text-[11px] text-muted">
                            <AtSign className="h-3 w-3" />
                            {th.userNickname}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted">
                            {th.lastText || "—"}
                          </span>
                          {th.awaitingReply && (
                            <span className="chip shrink-0 bg-danger/15 text-[10px] text-danger">
                              kutmoqda
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </NavLink>
              </motion.div>
            ))
          )}
        </div>

        {/* ============ Pastki panel — profil + navigatsiya (qayta joylashtirildi) ============ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-2 border-t border-line/10 p-2.5"
        >
          {/* Profil kartasi — avatar + ism + online belgisi */}
          <div className="flex items-center gap-2.5 rounded-2xl border border-line/10 bg-gradient-to-r from-card/80 to-card/40 p-2">
            <div className="relative shrink-0">
              {user?.avatarUrl ? (
                <img
                  src={assetUrl(user.avatarUrl)}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-accent/30"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-sm font-bold text-white shadow-glow">
                  {initials(user?.name)}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">
                {user?.name} {user?.surname || ""}
              </div>
              <div className="truncate text-xs text-muted">
                Ustoz{waitingCount > 0 ? ` · ${waitingCount} kutmoqda` : " · onlayn"}
              </div>
            </div>
          </div>

          {/* Navigatsiya — Testlar / Sozlamalar (aktiv pill silliq siljiydi) */}
          <div className="grid grid-cols-2 gap-1.5">
            {FOOTER_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors duration-200",
                    isActive ? "text-white" : "text-muted hover:bg-card/70 hover:text-ink"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="teacher-footer-pill"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent to-accent-dark shadow-glow"
                      />
                    )}
                    <item.icon className="relative z-10 h-4 w-4" />
                    <span className="relative z-10">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Tema almashtirgich + chiqish */}
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="ml-auto flex h-10 items-center gap-1.5 rounded-xl border border-danger/20 bg-danger/10 px-3 text-xs font-semibold text-danger transition-all hover:-translate-y-0.5 hover:bg-danger/20"
              title="Chiqish"
            >
              <LogOut className="h-4 w-4" />
              Chiqish
            </button>
          </div>
        </motion.div>
      </aside>

      {/* ================= O'ng panel — chat / testlar / sozlamalar ================= */}
      <main
        className={cn(
          "min-w-0 flex-1 flex-col",
          rightActive ? "flex" : "hidden lg:flex"
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
