import { NavLink } from "react-router-dom";
import { Home, Map, BookOpen, User } from "lucide-react";
import { cn } from "@/utils/cn";
import { useT } from "@/i18n";

export default function BottomNav() {
  const t = useT();
  const items = [
    { to: "/app", label: t("nav.home"), icon: Home, end: true },
    { to: "/app/roadmap", label: t("nav.path"), icon: Map },
    { to: "/app/my-words", label: t("nav.words"), icon: BookOpen },
    { to: "/app/profile", label: t("nav.profile"), icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-surface-200 bg-white safe-bottom dark:border-slate-800 dark:bg-slate-900 lg:hidden">
      <div className="flex items-stretch h-16">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn("nav-item", isActive && "active")
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
