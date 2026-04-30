import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  Flame,
  Map,
  Play,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { learningApi } from "@/api/learning";
import { useAuthStore } from "@/store/authStore";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { getLanguageLabel } from "@/utils/language";
import { cn } from "@/utils/cn";
import { useT, type TFunction } from "@/i18n";
import { useLocaleStore } from "@/store/localeStore";

function enumLabel(t: TFunction, baseKey: string, value?: string, fallbackKey?: string) {
  if (!value) return fallbackKey ? t(fallbackKey) : "";
  const key = `${baseKey}.${value}`;
  const label = t(key);
  return label === key ? value.replace(/_/g, " ") : label;
}

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const locale = useLocaleStore((s) => s.locale);
  const t = useT();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["learning", "dashboard"],
    queryFn: async () => {
      const res = await learningApi.dashboard();
      return res.data.data;
    },
  });

  const firstName = user?.name?.split(" ")[0] || t("home.fallbackName");

  if (isLoading) {
    return <LoadingSpinner className="py-20" />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 pt-5 lg:px-10 lg:pt-10">
      {/* Page header — compact on mobile, spacious on desktop */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-0.5 text-xs font-semibold text-brand-500">
            {t("home.course", { language: getLanguageLabel(user?.studyLanguage, locale) })}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">{t("home.welcomeBack", { name: firstName })}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5">
          <Flame size={15} className="text-orange-500" />
          <span className="text-sm font-bold text-orange-600">
            {t("home.dayStreak", { count: user?.streak || 0 })}
          </span>
        </div>
      </div>

      {/*
        Single 4-area grid with explicit mobile order.
        Mobile (1-col): Continue Learning → Path for Today → Learner Profile → What to Strengthen
        Desktop (2-col): Continue Learning | Learner Profile / Path for Today | What to Strengthen
      */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-5">
        {/* Continue Learning — always first on mobile and desktop */}
        <section className="order-1 min-w-0 max-w-full rounded-3xl bg-slate-900 p-5 text-white shadow-card">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">
                {t("home.continueLearning")}
              </p>
              <h2 className="text-xl font-bold leading-tight lg:text-2xl">
                {dashboard?.continueLearning?.title || t("home.startFirstLesson")}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {t("home.unitLesson", {
                  unit: dashboard?.continueLearning?.unit ?? 1,
                  lesson: dashboard?.continueLearning?.lesson ?? 1,
                })}
                {dashboard?.continueLearning?.scriptFocus
                  ? ` · ${enumLabel(t, "home.scriptStages", dashboard.continueLearning.scriptFocus)}`
                  : ""}
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-white/10 p-2.5">
              <BookOpenCheck size={22} className="text-brand-200" />
            </div>
          </div>

          {/* Stats row */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10px] text-slate-300">{t("home.roadmap")}</p>
              <p className="text-xl font-bold">{dashboard?.roadmapProgressPercent ?? 0}%</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10px] text-slate-300">{t("home.wordsIntroduced")}</p>
              <p className="text-xl font-bold">{dashboard?.introducedCount ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10px] text-slate-300">{t("home.reviewDue")}</p>
              <p className="text-xl font-bold">{dashboard?.reviewDueCount ?? 0}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => navigate("/app/practice?mode=lesson")}
              className="btn-primary inline-flex flex-1 items-center justify-center gap-2"
            >
              <Play size={16} />
              {t("home.continueLesson")}
            </button>
            <button
              onClick={() => navigate("/app/roadmap")}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/15"
            >
              <Map size={16} />
              {t("home.viewPath")}
            </button>
          </div>
        </section>

        {/* Learner Profile — order-3 on mobile (below Path for Today), col-2 row-1 on desktop */}
        <section className="order-3 min-w-0 max-w-full rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100 lg:order-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t("home.learnerProfile")}
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                {dashboard?.learner.level} · {enumLabel(t, "home.learnerStages", dashboard?.learner.learnerStage, "home.learnerStages.guided")}
              </h2>
            </div>
            <Sparkles size={20} className="text-brand-500" />
          </div>
          <div className="space-y-2">
            <div className="rounded-2xl bg-surface-50 p-3">
              <p className="text-xs font-semibold text-slate-400">{t("home.placementConfidence")}</p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-brand-600"
                  style={{ width: `${Math.round((dashboard?.learner.placementConfidence ?? 0) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {dashboard?.learner.placementSource === "placement_test"
                  ? t("home.placementTest")
                  : t("home.manualPlacement")} ·{" "}
                {Math.round((dashboard?.learner.placementConfidence ?? 0) * 100)}%
              </p>
            </div>
            <div className="rounded-2xl bg-surface-50 p-3">
              <p className="text-xs font-semibold text-slate-400">{t("home.scriptStage")}</p>
              <p className="mt-0.5 font-bold capitalize text-slate-900">
                {enumLabel(t, "home.scriptStages", dashboard?.learner.scriptStage)}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Second row — same single responsive grid approach */}
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-5">
        {/* What to Strengthen — order-4 on mobile, left col on desktop */}
        <section className="order-4 min-w-0 max-w-full rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100 lg:order-3">
          <div className="mb-3 flex items-center gap-2">
            <Brain size={17} className="text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">{t("home.whatToStrengthen")}</h2>
          </div>
          <div className="space-y-2">
            {(dashboard?.learner.skillWeaknesses ?? []).length > 0 ? (
              dashboard!.learner.skillWeaknesses.map((weakness) => (
                <div key={weakness.skill} className="min-w-0 rounded-2xl bg-surface-50 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold capitalize text-slate-700">
                      {enumLabel(t, "home.skills", weakness.skill)}
                    </span>
                    <span className="shrink-0 pl-2 text-slate-500">{Math.round(weakness.score * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-amber-400" style={{ width: `${Math.round(weakness.score * 100)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-surface-50 p-4 text-sm text-slate-500">
                {t("home.weaknessesEmpty")}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate("/app/practice?mode=review")}
            className="btn-secondary mt-3 inline-flex w-full items-center justify-center gap-2"
          >
            <RefreshCcw size={15} />
            {t("home.reviewNow")}
          </button>
        </section>

        {/* Path for Today — order-2 on mobile: visible right after Continue Learning */}
        <section className="order-2 min-w-0 max-w-full rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100 lg:order-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Target size={17} className="shrink-0 text-brand-600" />
              <h2 className="text-base font-bold text-slate-900">{t("home.dailyPath")}</h2>
            </div>
            <button
              onClick={() => navigate("/app/roadmap")}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600"
            >
              {t("home.path")} <ArrowRight size={13} />
            </button>
          </div>
          <div className="space-y-2">
            {(dashboard?.dailyPath ?? []).map((node, index) => {
              const status = node.progress?.status ?? "locked";
              return (
                <button
                  key={node.id || node._id || node.nodeKey}
                  disabled={status === "locked"}
                  onClick={() => navigate("/app/roadmap")}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition",
                    status === "completed"
                      ? "border-green-200 bg-green-50"
                      : status === "in_progress"
                        ? "border-brand-300 bg-brand-50"
                        : status === "available"
                          ? "border-slate-200 bg-white hover:border-brand-200 active:bg-brand-50"
                          : "border-slate-100 bg-slate-50 opacity-50"
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-700 shadow-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{node.title}</p>
                    <p className="truncate text-xs text-slate-500">{node.objective}</p>
                  </div>
                  <span className="max-w-[34%] shrink-0 truncate text-xs font-semibold capitalize text-slate-400">
                    {enumLabel(t, "home.nodeStatus", status)}
                  </span>
                </button>
              );
            })}
            {(dashboard?.dailyPath ?? []).length === 0 && (
              <p className="rounded-2xl bg-surface-50 p-4 text-sm text-slate-500">
                {t("home.roadmapReady")}
              </p>
            )}
          </div>
        </section>
      </div>

      {/*
        Bottom clearance:
        - Mobile: fixed BottomNav is h-16 (64px) + safe-area-inset-bottom (up to ~40px on iPhone) = ~104px
        - We use pb-safe to account for safe areas, plus the spacer covers the nav height
      */}
      <div className="h-32 lg:h-10" aria-hidden="true" />
    </div>
  );
}
