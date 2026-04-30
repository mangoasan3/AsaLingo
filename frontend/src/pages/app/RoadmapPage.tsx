import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Flame,
  Lock,
  Map,
  Play,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { learningApi } from "@/api/learning";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useCurrentUser } from "@/hooks/useAuth";
import { useT } from "@/i18n";
import { useLocaleStore } from "@/store/localeStore";
import { cn } from "@/utils/cn";
import { getLanguageLabel } from "@/utils/language";
import type { CurriculumNode } from "@/types";

const ROW_HEIGHT = 144;
const PATH_X = [50, 34, 66, 54, 28, 46, 72, 58, 36, 62];

// Milestone nodes (every 5th, or lesson 1 of a new unit) get a larger visual treatment
function isMilestone(index: number, node: CurriculumNode) {
  return index % 5 === 0 || node.lesson === 1;
}

function nodeId(node: CurriculumNode) {
  return node.id || node._id || node.nodeKey;
}

function nodeStatus(node: CurriculumNode) {
  return node.progress?.status ?? "locked";
}

// Primary skill focus drives color theming
function nodePrimarySkill(node: CurriculumNode): string {
  const skills = node.skillFocus ?? [];
  if (skills.includes("script")) return "script";
  if (skills.includes("writing")) return "writing";
  if (skills.includes("grammar")) return "grammar";
  if (skills.includes("reading")) return "reading";
  if (skills.includes("listening")) return "listening";
  return "vocabulary";
}

function nodePoint(index: number) {
  return {
    x: PATH_X[index % PATH_X.length],
    y: index * ROW_HEIGHT + 70,
  };
}

function pathPoints(nodes: CurriculumNode[]) {
  return nodes.map((_, index) => nodePoint(index));
}

function toPolyline(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

const SKILL_ICONS = {
  script: Sparkles,
  writing: Sparkles,
  grammar: BookOpen,
  reading: BookOpen,
  listening: Star,
  vocabulary: Star,
} as const;

function NodeIcon({ node, index }: { node: CurriculumNode; index: number }) {
  const status = nodeStatus(node);
  if (status === "completed") return <CheckCircle2 size={isMilestone(index, node) ? 34 : 28} />;
  if (status === "locked") return <Lock size={isMilestone(index, node) ? 28 : 22} />;
  if (status === "in_progress") return <Play size={isMilestone(index, node) ? 34 : 28} fill="currentColor" />;
  // Available nodes: first node gets Flame, every 5th gets Trophy, skill-driven otherwise
  if (index === 0) return <Flame size={isMilestone(index, node) ? 34 : 28} />;
  if (index % 5 === 0) return <Trophy size={34} />;
  const skill = nodePrimarySkill(node);
  const Icon = SKILL_ICONS[skill as keyof typeof SKILL_ICONS] ?? Star;
  return <Icon size={isMilestone(index, node) ? 34 : 26} fill={skill === "vocabulary" || skill === "listening" ? "currentColor" : undefined} />;
}

// Completed/locked tones are status-only; available/in-progress use skill colors
const SKILL_AVAILABLE_TONES: Record<string, string> = {
  vocabulary: "bg-amber-400 text-amber-950 shadow-[0_8px_0_#d97706]",
  grammar:    "bg-indigo-400 text-white shadow-[0_8px_0_#4338ca]",
  reading:    "bg-teal-400 text-white shadow-[0_8px_0_#0f766e]",
  writing:    "bg-purple-400 text-white shadow-[0_8px_0_#7e22ce]",
  listening:  "bg-sky-400 text-white shadow-[0_8px_0_#0369a1]",
  script:     "bg-orange-400 text-white shadow-[0_8px_0_#c2410c]",
};

const SKILL_ACTIVE_TONES: Record<string, string> = {
  vocabulary: "bg-brand-600 text-white shadow-[0_8px_0_#3636a6]",
  grammar:    "bg-indigo-600 text-white shadow-[0_8px_0_#3730a3]",
  reading:    "bg-teal-600 text-white shadow-[0_8px_0_#0f766e]",
  writing:    "bg-purple-600 text-white shadow-[0_8px_0_#581c87]",
  listening:  "bg-sky-500 text-white shadow-[0_8px_0_#0369a1]",
  script:     "bg-orange-500 text-white shadow-[0_8px_0_#c2410c]",
};

function nodeTone(node: CurriculumNode) {
  const status = nodeStatus(node);
  if (status === "completed") return "bg-emerald-500 text-white shadow-[0_8px_0_#15803d]";
  if (status === "locked") return "bg-slate-200 text-slate-400 shadow-[0_8px_0_#cbd5e1]";
  const skill = nodePrimarySkill(node);
  if (status === "in_progress") return SKILL_ACTIVE_TONES[skill] ?? SKILL_ACTIVE_TONES.vocabulary;
  return SKILL_AVAILABLE_TONES[skill] ?? SKILL_AVAILABLE_TONES.vocabulary;
}

const SKILL_RING_COLORS: Record<string, string> = {
  vocabulary: "#4f51e8",
  grammar:    "#6366f1",
  reading:    "#14b8a6",
  writing:    "#a855f7",
  listening:  "#38bdf8",
  script:     "#fb923c",
};

function ringColor(node: CurriculumNode) {
  const status = nodeStatus(node);
  if (status === "completed") return "#22c55e";
  if (status === "available") return "#f59e0b";
  if (status === "in_progress") {
    const skill = nodePrimarySkill(node);
    return SKILL_RING_COLORS[skill] ?? "#4f51e8";
  }
  return "#cbd5e1";
}

const SKILL_BADGE_COLORS: Record<string, string> = {
  vocabulary: "bg-amber-50 text-amber-700",
  grammar:    "bg-indigo-50 text-indigo-700",
  reading:    "bg-teal-50 text-teal-700",
  writing:    "bg-purple-50 text-purple-700",
  listening:  "bg-sky-50 text-sky-700",
  script:     "bg-orange-50 text-orange-700",
};

function nodeStatusLabel(t: ReturnType<typeof useT>, status: string) {
  const key = `roadmap.status.${status}`;
  const label = t(key);
  return label === key ? status.replace(/_/g, " ") : label;
}

export default function RoadmapPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = useT();
  const locale = useLocaleStore((state) => state.locale);
  const { data: user } = useCurrentUser();
  const { data: roadmap, isLoading } = useQuery({
    queryKey: ["learning", "roadmap"],
    queryFn: async () => {
      const res = await learningApi.roadmap();
      return res.data.data;
    },
  });

  const startNode = useMutation({
    mutationFn: (nextNodeId: string) => learningApi.startNode(nextNodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning"] });
      navigate("/app/practice?mode=lesson");
    },
  });

  if (isLoading) return <LoadingSpinner className="py-20" />;

  const nodes = roadmap?.nodes ?? [];
  const points = pathPoints(nodes);
  const pathHeight = Math.max(320, nodes.length * ROW_HEIGHT + 88);
  const completedCount = nodes.filter((node) => nodeStatus(node) === "completed").length;
  const activeIndex = Math.max(
    nodes.findIndex((node) => nodeStatus(node) === "in_progress"),
    completedCount > 0 ? completedCount - 1 : 0
  );
  const activePoints = points.slice(0, Math.max(1, activeIndex + 1));
  const progressPercent = nodes.length > 0 ? Math.round((completedCount / nodes.length) * 100) : 0;

  if (nodes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-10 lg:px-10">
        <EmptyState
          icon={Map}
          title={t("roadmap.unavailableTitle")}
          description={t("roadmap.unavailableDescription")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-4 lg:px-10 lg:pb-12 lg:pt-8">
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-slate-200 bg-surface-50/95 px-4 py-4 backdrop-blur lg:-mx-10 lg:px-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">
              {t("roadmap.unit", { unit: nodes[Math.min(activeIndex, nodes.length - 1)]?.unit ?? 1 })}
            </p>
            <h1 className="truncate text-2xl font-black text-slate-900">
              {nodes[Math.min(activeIndex, nodes.length - 1)]?.stage ?? t("roadmap.fallbackTitle")}
            </h1>
            {user && (
              <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                {t("roadmap.languagePair", {
                  native: getLanguageLabel(user.nativeLanguage, locale),
                  target: getLanguageLabel(user.studyLanguage, locale),
                })}
              </p>
            )}
          </div>
          <div className="w-32 shrink-0">
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>{completedCount}/{nodes.length}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-slate-200 bg-white">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-2xl" style={{ height: pathHeight }}>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 100 ${pathHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points={toPolyline(points)}
            fill="none"
            stroke="#d7dee8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="6"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={toPolyline(activePoints)}
            fill="none"
            stroke="#22c55e"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {nodes.map((node, index) => {
          const status = nodeStatus(node);
          const statusLabel = nodeStatusLabel(t, status);
          const point = points[index];
          const disabled = status === "locked" || startNode.isPending;
          const progress = node.progress?.progressPercent ?? 0;
          const currentNodeId = nodeId(node);
          const milestone = isMilestone(index, node);
          const skill = nodePrimarySkill(node);
          const nodeSize = milestone ? "h-24 w-24" : "h-20 w-20";
          const insetRing = milestone ? "-inset-3" : "-inset-2";

          return (
            <div
              key={currentNodeId}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${point.x}%`, top: point.y }}
            >
              <button
                type="button"
                disabled={disabled}
                title={`${node.title} - ${statusLabel}`}
                aria-label={`${node.title} - ${statusLabel}`}
                onClick={() => startNode.mutate(currentNodeId)}
                className={cn(
                  "relative flex items-center justify-center rounded-full border-4 border-white text-center transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed",
                  nodeSize,
                  nodeTone(node),
                  status === "in_progress" && "ring-8 ring-brand-100",
                  milestone && status === "in_progress" && "ring-[10px]",
                  startNode.isPending && startNode.variables === currentNodeId && "animate-pulse"
                )}
              >
                {status !== "locked" && status !== "completed" && (
                  <span
                    className={cn("absolute rounded-full", insetRing)}
                    style={{
                      background: `conic-gradient(${ringColor(node)} ${progress * 3.6}deg, transparent 0deg)`,
                    }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 flex h-full w-full items-center justify-center rounded-full">
                  <NodeIcon node={node} index={index} />
                </span>
              </button>
              <div className={cn("mt-3 text-center", milestone ? "w-44 max-w-[48vw]" : "w-40 max-w-[44vw]")}>
                <p className={cn("truncate font-black text-slate-900", milestone ? "text-sm" : "text-sm")}>
                  {node.title}
                </p>
                <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                  {node.level} · {t("roadmap.lesson", { lesson: node.lesson })}
                </p>
                {/* Skill badge — only for non-locked nodes, so the learner gets context */}
                {status !== "locked" && (
                  <span className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    SKILL_BADGE_COLORS[skill] ?? "bg-slate-50 text-slate-500"
                  )}>
                    {skill}
                  </span>
                )}
                {status === "locked" && node.recommendedVocabulary?.length > 0 && (
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                    {t("roadmap.vocabularyPreview", {
                      words: node.recommendedVocabulary.slice(0, 3).join(", "),
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
