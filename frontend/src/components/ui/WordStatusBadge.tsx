import type { WordStatus } from "@/types";
import { cn } from "@/utils/cn";
import { useT } from "@/i18n";

const styles: Record<WordStatus, string> = {
  NEW: "bg-slate-100 text-slate-600",
  LEARNING: "bg-amber-100 text-amber-700",
  LEARNED: "bg-green-100 text-green-700",
  DIFFICULT: "bg-red-100 text-red-600",
  SAVED: "bg-brand-100 text-brand-700",
};

export default function WordStatusBadge({ status }: { status: WordStatus }) {
  const t = useT();
  return (
    <span className={cn("level-badge", styles[status])}>
      {t(`word.status.${status}`)}
    </span>
  );
}
