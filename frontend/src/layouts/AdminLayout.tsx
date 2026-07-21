import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Receipt,
  Settings as SettingsIcon,
  Tags,
  Users,
  Users2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";

function useAdminNav() {
  const { t } = useTranslation();
  return [
    { to: "/admin", label: t("admin.dashboard"), icon: LayoutDashboard, end: true },
    { to: "/admin/questions", label: t("admin.questions"), icon: ListChecks },
    { to: "/admin/topics", label: t("admin.topics"), icon: Tags },
    { to: "/admin/teachers", label: t("admin.teachers"), icon: GraduationCap },
    { to: "/admin/tariffs", label: t("admin.tariffs"), icon: CreditCard },
    { to: "/admin/payments", label: t("admin.payments"), icon: Receipt },
    { to: "/admin/users", label: t("admin.users"), icon: Users },
    { to: "/admin/referral", label: t("admin.referral"), icon: Users2 },
    { to: "/admin/settings", label: t("admin.settings"), icon: SettingsIcon },
  ];
}

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const nav = useAdminNav();
  const navigate = useNavigate();
  const logoutAdmin = useAuth((s) => s.logoutAdmin);
  return (
    <div className="flex h-full flex-col">
      <NavLink to="/admin" onClick={onNavigate} className="block">
        <Logo admin />
      </NavLink>

      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {nav.map((item, i) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.3 }}
          >
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "text-accent" : "text-muted hover:bg-card/50 hover:text-ink"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="admin-active-bg"
                      className="absolute inset-0 -z-10 rounded-xl bg-accent/15 ring-1 ring-inset ring-accent/25"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-transform duration-200",
                      isActive ? "scale-110" : "group-hover:scale-110"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          </motion.div>
        ))}
      </nav>

      <div className="mt-4 space-y-3 border-t border-line/10 pt-4">
        <div className="flex items-center justify-between">
          <LangSwitcher />
          <ThemeSwitcher />
        </div>
        <button
          onClick={() => {
            logoutAdmin();
            navigate("/login");
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t("common.logout")}
        </button>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 p-4 lg:block">
        <div className="glass-card h-full p-4">
          <AdminSidebar />
        </div>
      </aside>

      {/* Mobil drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="glass-card absolute left-0 top-0 h-full w-72 max-w-[82vw] rounded-none p-4"
            >
              <AdminSidebar onNavigate={() => setOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-w-0 flex-1">
        {/* Faqat mobil: menyu ochish tugmasi (desktop'da header yo'q — sidebar yetarli) */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/10 bg-bg/80 p-3 backdrop-blur-xl lg:hidden">
          <Logo admin />
          <button
            onClick={() => setOpen(true)}
            className="btn-ghost p-2"
            aria-label="Menyu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="p-4 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
