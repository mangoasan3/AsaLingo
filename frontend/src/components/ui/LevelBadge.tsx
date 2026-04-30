import type { CefrLevel } from "@/types";
import { cn } from "@/utils/cn";

const styles: Record<CefrLevel, string> = {
  A1: "bg-green-100 text-green-700",
  A2: "bg-emerald-100 text-emerald-700",
  B1: "bg-blue-100 text-blue-700",
  B2: "bg-indigo-100 text-indigo-700",
  C1: "bg-purple-100 text-purple-700",
  C2: "bg-rose-100 text-rose-700",
};

export default function LevelBadge({ level, className }: { level: CefrLevel; className?: string }) {
  return (
    <span className={cn("level-badge", styles[level], className)}>
      {level}
    </span>
  );
}
