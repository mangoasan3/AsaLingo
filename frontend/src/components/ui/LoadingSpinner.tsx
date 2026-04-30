import { useT } from "@/i18n";
import { cn } from "@/utils/cn";

export default function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}

export function FullPageLoader() {
  const t = useT();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{t("common.loading")}</p>
      </div>
    </div>
  );
}
