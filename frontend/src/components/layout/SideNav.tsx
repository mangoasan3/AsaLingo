import { NavLink } from "react-router-dom";
import { Home, Map, BookOpen, User } from "lucide-react";
import { cn } from "@/utils/cn";
import { useT } from "@/i18n";

export default function SideNav() {
  const t = useT();
  const items = [
    { to: "/app", label: t("nav.continue"), icon: Home, end: true },
    { to: "/app/roadmap", label: t("nav.roadmap"), icon: Map },
    { to: "/app/my-words", label: t("nav.reviewWords"), icon: BookOpen },
    { to: "/app/profile", label: t("nav.profile"), icon: User },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 hidden min-h-screen w-60 flex-col border-r border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex xl:w-64">
      {/* Logo */}
      <div className="border-b border-slate-100 px-6 py-6 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <img src="/app-icon.png" alt={t("common.appName")} className="h-full w-full object-cover" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">{t("common.appName")}</span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom decorative element */}
      <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
        <div className="text-center text-xs text-slate-400 dark:text-slate-500">{t("common.copyright", { year: 2026 })}</div>
      </div>
    </aside>
  );
}
