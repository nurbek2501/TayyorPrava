import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  MessagesSquare,
  Radio,
  ShieldX,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "@/components/shared/Logo";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { useAuth } from "@/store/auth";
import { cn, initials } from "@/lib/utils";
import { assetUrl } from "@/lib/api";

function useNav() {
  const { t } = useTranslation();
  return [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/lesson", label: t("nav.practice"), icon: GraduationCap },
    { to: "/exam", label: t("nav.exam"), icon: LayoutGrid },
    { to: "/real-exam", label: t("nav.realExam"), icon: Radio, live: true },
    { to: "/teachers", label: t("nav.teachers"), icon: MessagesSquare },
    { to: "/mistakes", label: t("nav.mistakes"), icon: ShieldX },
    { to: "/payment", label: t("nav.subscribe"), icon: CreditCard },
  ];
}

function SidebarContent({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { t } = useTranslation();
  const nav = useNav();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logoutUser);

  return (
    <div className="flex h-full flex-col">
      <NavLink
        to="/dashboard"
        onClick={onNavigate}
        className={cn("flex items-center px-1 py-1", collapsed && "justify-center")}
      >
        <Logo compact={collapsed} />
      </NavLink>

      {!collapsed && (
        <div className="mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted/70">
          {t("nav.menu")}
        </div>
      )}

      <nav
        className={cn(
          "-mr-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-2",
          collapsed ? "mt-6" : "mt-2"
        )}
      >
        {nav.map((item, i) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            style={{ animationDelay: `${i * 45}ms` }}
            className={({ isActive }) =>
              cn(
                "group animate-fade-up relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "text-white"
                  : "text-muted hover:translate-x-0.5 hover:bg-card/70 hover:text-ink",
                collapsed && "justify-center px-0"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="user-active-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent to-accent-dark shadow-glow"
                  />
                )}
                <span className="relative z-10 flex items-center">
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110",
                      isActive && "scale-105"
                    )}
                  />
                </span>
                {!collapsed && <span className="relative z-10 flex-1 truncate">{item.label}</span>}
                {item.live && !collapsed && (
                  <span
                    className={cn(
                      "chip relative z-10",
                      isActive ? "bg-white/20 text-white" : "bg-danger/20 text-danger"
                    )}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                    LIVE
                  </span>
                )}
                {item.live && collapsed && (
                  <span className="absolute right-1.5 top-1.5 z-10 h-2 w-2 animate-pulse rounded-full bg-danger ring-2 ring-card" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 space-y-3 border-t border-line/10 pt-4">
        {!collapsed && (
          <div className="flex flex-wrap items-center gap-2">
            <LangSwitcher />
            <ThemeSwitcher />
          </div>
        )}

        <NavLink
          to="/profile"
          onClick={onNavigate}
          title={collapsed ? user?.name || "Profil" : undefined}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-xl border bg-gradient-to-r from-card/80 to-card/40 p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow",
              isActive ? "border-accent/50 bg-accent/10" : "border-line/10 hover:border-accent/40",
              collapsed && "justify-center px-1.5"
            )
          }
        >
          <div className="relative shrink-0">
            {user?.avatarUrl ? (
              <img
                src={assetUrl(user.avatarUrl)}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-2 ring-accent/30 transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-sm font-bold text-white shadow-glow transition-transform duration-200 group-hover:scale-105">
                {initials(user?.name)}
              </div>
            )}
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                user?.subscriptionActive ? "bg-success" : "bg-muted"
              )}
            />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">
                {user?.name || "Foydalanuvchi"}
              </div>
              <div
                className={cn(
                  "truncate text-xs",
                  user?.subscriptionActive ? "font-semibold text-success" : "text-muted"
                )}
              >
                {user?.subscriptionActive ? "PRO • aktiv obuna" : user?.phone}
              </div>
            </div>
          )}
          {!collapsed && (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
          )}
        </NavLink>

        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          title={collapsed ? t("common.logout") : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && t("common.logout")}
        </button>
      </div>
    </div>
  );
}

export function UserLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("pp_sidebar_collapsed") === "1"
  );
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const n = !c;
      localStorage.setItem("pp_sidebar_collapsed", n ? "1" : "0");
      return n;
    });

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 p-4 transition-[width] duration-300 ease-out lg:block",
          collapsed ? "w-[100px]" : "w-72"
        )}
      >
        <div className="relative h-full rounded-2xl bg-gradient-to-b from-accent/30 via-transparent to-accent-dark/20 p-px shadow-glass">
          <div className="h-full overflow-hidden rounded-2xl bg-card/70 p-4 backdrop-blur-xl">
            <SidebarContent collapsed={collapsed} />
          </div>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Kengaytirish" : "Yig'ish"}
            className="absolute -right-3 top-9 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-line/20 bg-card text-muted shadow-glow transition hover:scale-110 hover:text-accent"
          >
            <ChevronLeft
              className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
            />
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/10 bg-bg/80 p-4 backdrop-blur-xl lg:hidden">
        <Logo />
        <button
          onClick={() => setOpen(true)}
          className="btn-ghost p-2"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute left-0 top-0 h-full w-72 border-r border-line/10 bg-card/90 p-4 backdrop-blur-2xl"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 z-10 text-muted transition hover:text-ink"
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 p-4 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
