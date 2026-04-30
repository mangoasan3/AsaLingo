import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ImageIcon,
  Keyboard,
  Sparkles,
  Trophy,
  Wand2,
  XCircle,
} from "lucide-react";
import { learningApi } from "@/api/learning";
import { aiApi } from "@/api/practice";
import { usersApi } from "@/api/users";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { useT, type TFunction } from "@/i18n";
import {
  evaluateQuizAnswerLocally,
  normalizePracticeText,
  shouldUseAiEvaluation,
} from "@/lib/practiceEvaluation";
import toast from "@/lib/toast";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/utils/cn";
import { getYoutubeEmbedUrl } from "@/utils/youtube";
import type {
  LessonSubmissionSummary,
  LessonPayload,
  PracticeSubmissionResult,
  QuizAnswerEvaluation,
  QuizQuestion,
} from "@/types";

type Mode = "quiz" | "done";
type PracticeMode = "lesson" | "review" | "challenge";

interface AnswerState {
  value: string;
  selectedOption: string | null;
  submitted: boolean;
  evaluation: QuizAnswerEvaluation | null;
  selectedTokenIndices: number[];
  matchingAnswers: Record<string, string>;
}

const PRACTICE_MODES: PracticeMode[] = ["lesson", "review", "challenge"];
const CONFETTI_DOTS = [
  { x: "-120px", y: "-70px", color: "#fb7185" },
  { x: "-88px", y: "-118px", color: "#f59e0b" },
  { x: "-34px", y: "-128px", color: "#38bdf8" },
  { x: "18px", y: "-132px", color: "#818cf8" },
  { x: "72px", y: "-112px", color: "#34d399" },
  { x: "116px", y: "-68px", color: "#f97316" },
  { x: "104px", y: "22px", color: "#e879f9" },
  { x: "58px", y: "74px", color: "#22c55e" },
  { x: "-8px", y: "92px", color: "#f43f5e" },
  { x: "-72px", y: "82px", color: "#0ea5e9" },
  { x: "-118px", y: "18px", color: "#a3e635" },
  { x: "-98px", y: "-18px", color: "#facc15" },
];

function getPracticeMode(value: string | null): PracticeMode {
  return PRACTICE_MODES.includes(value as PracticeMode) ? (value as PracticeMode) : "lesson";
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeGeneratedQuestion(question: QuizQuestion): QuizQuestion | null {
  const record = question as QuizQuestion & Record<string, unknown>;
  if (!record || typeof record !== "object") return null;
  if (!record.type || !record.question || !record.wordId || !record.questionHash) return null;

  const normalized: Record<string, unknown> = {
    ...record,
    type: String(record.type),
    question: String(record.question),
    wordId: String(record.wordId),
    questionHash: String(record.questionHash),
  };

  if ("options" in normalized) normalized.options = toStringArray(normalized.options);
  if ("acceptedAnswers" in normalized) normalized.acceptedAnswers = toStringArray(normalized.acceptedAnswers);
  if ("tokens" in normalized) normalized.tokens = toStringArray(normalized.tokens);
  if ("rubric" in normalized) normalized.rubric = toStringArray(normalized.rubric);
  if ("keywordHints" in normalized) normalized.keywordHints = toStringArray(normalized.keywordHints);
  if ("instructions" in normalized) normalized.instructions = toStringArray(normalized.instructions);
  if ("helpfulTips" in normalized) normalized.helpfulTips = toStringArray(normalized.helpfulTips);
  if ("pairs" in normalized && Array.isArray(normalized.pairs)) {
    normalized.pairs = normalized.pairs
      .map((pair) => {
        const item = pair as Record<string, unknown>;
        const left = String(item.left ?? "").trim();
        const right = String(item.right ?? "").trim();
        return left && right ? { left, right } : null;
      })
      .filter(Boolean);
  }

  return normalized as unknown as QuizQuestion;
}

function typeLabel(question: QuizQuestion | undefined, t: TFunction) {
  if (!question) return "";
  const key = `practice.exerciseTypes.${question.type}`;
  const label = t(key);
  return label === key ? question.type.replace(/_/g, " ") : label;
}

function isCorrectEvaluation(evaluation?: Pick<QuizAnswerEvaluation, "status" | "correct"> | null) {
  return Boolean(
    evaluation?.status === "correct" || (evaluation?.status == null && evaluation?.correct)
  );
}

function isPendingReview(evaluation?: Pick<QuizAnswerEvaluation, "status"> | null) {
  return evaluation?.status === "pending_review";
}

function AiGenerationLoader({ mode, onLeave }: { mode: PracticeMode; onLeave: () => void }) {
  const t = useT();
  const [completedSteps, setCompletedSteps] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setCompletedSteps(1), 900);
    const t2 = setTimeout(() => setCompletedSteps(2), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const modeLabel =
    mode === "review"
      ? t("practice.live.reviewMode")
      : mode === "challenge"
        ? t("practice.live.challengeMode")
        : t("practice.live.lessonMode");

  const steps = [
    t("practice.live.selectingWords"),
    t("practice.live.writingPrompts"),
    t("practice.live.checkingOptions"),
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center px-5 pb-24 pt-10 text-center">
      <div className="relative mb-7 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-card ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <div className="absolute inset-3 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
        <Wand2 size={34} className="relative z-10 text-brand-600" />
      </div>
      <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-brand-700">
        <Sparkles size={14} />
        {t("practice.live.aiGeneration")}
      </p>
      <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">{t("practice.live.generatingTitle", { mode: modeLabel })}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {t("practice.live.generatingDescription")}
      </p>
      <div className="mt-7 grid w-full gap-2 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-card dark:border-slate-800 dark:bg-slate-900">
        {steps.map((item, index) => {
          const done = index < completedSteps;
          const active = index === completedSteps;
          return (
            <div
              key={item}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-300",
                done ? "bg-brand-50 dark:bg-brand-950/30" : active ? "bg-surface-100 dark:bg-slate-800" : "bg-surface-50 dark:bg-slate-900"
              )}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-colors duration-300",
                  done ? "bg-brand-600" : active ? "bg-brand-400 animate-pulse" : "bg-slate-300"
                )}
              />
              <span
                className={cn(
                  "text-sm font-semibold transition-colors duration-300",
                  done ? "text-brand-700 dark:text-brand-200" : active ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
                )}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
      <button className="btn-ghost mt-5" onClick={onLeave}>
        {t("practice.live.backToRoadmap")}
      </button>
    </div>
  );
}

export default function PracticePage() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);
  const initialMode = getPracticeMode(searchParams.get("mode"));
  const [mode, setMode] = useState<Mode>("quiz");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(initialMode);
  const [lesson, setLesson] = useState<LessonPayload | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<PracticeSubmissionResult[]>([]);
  const [submissionSummary, setSubmissionSummary] = useState<LessonSubmissionSummary | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [autoStarted, setAutoStarted] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationExitTarget, setGenerationExitTarget] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [streakDelta, setStreakDelta] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>({
    value: "",
    selectedOption: null,
    submitted: false,
    evaluation: null,
    selectedTokenIndices: [],
    matchingAnswers: {},
  });

  const resetAnswer = useCallback(() => {
    setAnswerState({
      value: "",
      selectedOption: null,
      submitted: false,
      evaluation: null,
      selectedTokenIndices: [],
      matchingAnswers: {},
    });
  }, []);

  const loadPractice = useMutation({
    mutationFn: async (nextMode: PracticeMode) => {
      if (nextMode === "lesson") {
        const res = await learningApi.continueLesson();
        return { ...res.data.data, mode: nextMode };
      }

      const res = await learningApi.practice(nextMode);
      return {
        exerciseSessionId: res.data.data.exerciseSessionId,
        node: res.data.data.node,
        focusWords: res.data.data.focusWords,
        exercises: res.data.data.exercises,
        phase: nextMode,
        scriptSupport: {
          language: res.data.data.node.language,
          scriptStage: res.data.data.node.scriptFocus || "latin",
          romajiAllowed: res.data.data.node.scriptFocus === "romaji",
          kanjiPolicy: "stage_aware",
        },
        mode: nextMode,
      } as LessonPayload & { mode: PracticeMode };
    },
    onMutate: () => {
      setGenerationError(null);
      setQuestions([]);
      setMode("quiz");
      setStreakDelta(0);
    },
    onSuccess: (payload) => {
      const safeQuestions = payload.exercises
        .map(normalizeGeneratedQuestion)
        .filter((item): item is QuizQuestion => Boolean(item));

      setLesson({ ...payload, exercises: safeQuestions });
      setQuestions(safeQuestions);
      setPracticeMode(payload.mode);
      setCurrentIdx(0);
      setResults([]);
      setSubmissionSummary(null);
      setStartTime(Date.now());
      setStreakDelta(0);
      resetAnswer();

      if (safeQuestions.length === 0) {
        setGenerationError(t("practice.live.emptyDescription"));
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t("practice.errors.failedGenerate");
      setGenerationError(message);
      toast.error(t("practice.errors.failedGenerate"));
    },
  });

  const submitSession = useMutation({
    mutationFn: (sessionResults: PracticeSubmissionResult[]) =>
      learningApi.submit({
        sessionType: practiceMode === "review" ? "ROADMAP_REVIEW" : "GUIDED_LESSON",
        exerciseSessionId: lesson?.exerciseSessionId || "",
        roadmapNodeId: lesson?.node.id || lesson?.node._id,
        results: sessionResults.map((result) => ({
          questionHash: result.questionHash || "",
          answer: result.answer || "",
        })),
        durationSecs: Math.floor((Date.now() - startTime) / 1000),
      }),
    onSuccess: async (response) => {
      setSubmissionSummary(response.data.data);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["learning"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["myWords"] });

      try {
        const previousStreak = authUser?.streak ?? 0;
        const meResponse = await usersApi.getMe();
        const updatedUser = meResponse.data.data;
        setAuthUser(updatedUser);
        queryClient.setQueryData(["me"], updatedUser);
        setStreakDelta(updatedUser.streak > previousStreak ? updatedUser.streak - previousStreak : 0);
      } catch {
        setStreakDelta(0);
      }
    },
  });

  const generationActive = loadPractice.isPending;
  const { mutate: startPractice } = loadPractice;

  useEffect(() => {
    if (!autoStarted) {
      setAutoStarted(true);
      setPracticeMode(initialMode);
      startPractice(initialMode);
    }
  }, [autoStarted, initialMode, startPractice]);

  useEffect(() => {
    resetAnswer();
  }, [currentIdx, resetAnswer]);

  useEffect(() => {
    if (!generationActive) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = t("practice.live.exitGeneration");
      return t("practice.live.exitGeneration");
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!anchor || anchor.target === "_blank") return;
      if (anchor.href === window.location.href) return;

      event.preventDefault();
      event.stopPropagation();
      setGenerationExitTarget(anchor.href);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [generationActive, t]);

  const leaveDuringGeneration = () => {
    if (!generationActive) {
      navigate("/app/roadmap");
      return;
    }
    setGenerationExitTarget("/app/roadmap");
  };

  const confirmGenerationExit = () => {
    const target = generationExitTarget ?? "/app/roadmap";
    setGenerationExitTarget(null);

    if (target.startsWith("/")) {
      navigate(target);
      return;
    }

    const url = new URL(target);
    if (url.origin === window.location.origin) {
      navigate(`${url.pathname}${url.search}${url.hash}`);
      return;
    }

    window.location.href = target;
  };

  const currentQuestion = questions[currentIdx];
  const scoreSoFar = useMemo(
    () =>
      results.filter((result) => result.evaluationStatus === "correct" || result.correct).length +
      (isCorrectEvaluation(answerState.evaluation) ? 1 : 0),
    [results, answerState.evaluation]
  );

  const getCurrentAnswerValue = (provided?: string) => {
    if (!currentQuestion) return "";
    if (provided != null) return provided;
    if (answerState.selectedOption) return answerState.selectedOption;
    if (currentQuestion.type === "reorder_words") {
      return answerState.selectedTokenIndices
        .map((tokenIndex) => currentQuestion.tokens[tokenIndex])
        .filter(Boolean)
        .join(" ");
    }
    if (currentQuestion.type === "matching") {
      return JSON.stringify(
        currentQuestion.pairs.map((pair) => ({
          left: pair.left,
          right: answerState.matchingAnswers[pair.left] ?? "",
        }))
      );
    }
    return answerState.value;
  };

  const AI_EVAL_TIMEOUT_MS = 14000;

  const submitAnswer = async (provided?: string) => {
    if (!currentQuestion || answerState.submitted || isEvaluating) return;
    const value =
      getCurrentAnswerValue(provided);
    if (!value.trim() && currentQuestion.type !== "matching") return;
    setIsEvaluating(true);
    let evaluation: QuizAnswerEvaluation;
    try {
      if (shouldUseAiEvaluation(currentQuestion)) {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), AI_EVAL_TIMEOUT_MS)
        );
        const response = await Promise.race([
          aiApi.evaluateQuizAnswer({ question: currentQuestion, answer: value }),
          timeout,
        ]);
        evaluation = response.data.data;
      } else {
        evaluation = evaluateQuizAnswerLocally(currentQuestion, value, t);
      }
    } catch {
      evaluation = evaluateQuizAnswerLocally(currentQuestion, value, t);
      toast.error(t("practice.errors.failedEvaluate"));
    } finally {
      setIsEvaluating(false);
    }

    setAnswerState((state) => ({
      ...state,
      value,
      selectedOption: provided ?? state.selectedOption,
      submitted: true,
      evaluation,
    }));
  };

  const nextQuestion = async () => {
    if (!currentQuestion || !answerState.evaluation || isEvaluating) return;
    const finalAnswer = getCurrentAnswerValue();
    const nextResults = [
      ...results,
      {
        wordId: currentQuestion.wordId,
        correct: isCorrectEvaluation(answerState.evaluation),
        evaluationStatus: answerState.evaluation.status,
        questionHash: currentQuestion.questionHash,
        questionType: currentQuestion.type,
        answer: finalAnswer || undefined,
        templateFamily: currentQuestion.exerciseMeta?.templateFamily,
      },
    ];
    setResults(nextResults);
    if (currentIdx + 1 >= questions.length) {
      try {
        await submitSession.mutateAsync(nextResults);
        setMode("done");
      } catch {
        toast.error(t("practice.errors.failedSubmit"));
        return;
      }
      return;
    }
    setCurrentIdx((current) => current + 1);
  };

  if (generationActive) {
    return (
      <>
        <AiGenerationLoader mode={practiceMode} onLeave={leaveDuringGeneration} />
        <ConfirmDialog
          open={Boolean(generationExitTarget)}
          title={t("practice.live.exitGenerationTitle")}
          description={t("practice.live.exitGenerationDescription")}
          confirmLabel={t("practice.live.exitGenerationConfirm")}
          cancelLabel={t("practice.live.exitGenerationCancel")}
          icon={<Wand2 size={21} />}
          onConfirm={confirmGenerationExit}
          onCancel={() => setGenerationExitTarget(null)}
        />
      </>
    );
  }

  if (generationError) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-24 pt-12">
        <EmptyState
          icon={AlertCircle}
          title={t("practice.live.generationFailedTitle")}
          description={generationError}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="btn-primary" onClick={() => loadPractice.mutate(practiceMode)}>
                {t("practice.live.tryAgain")}
              </button>
              <button className="btn-secondary" onClick={() => navigate("/app/roadmap")}>
                {t("practice.live.backToRoadmap")}
              </button>
            </div>
          }
        />
      </div>
    );
  }

  if (mode === "done") {
    const correct = submissionSummary?.correctCount ??
      results.filter((result) => result.evaluationStatus === "correct" || result.correct).length;
    const total = submissionSummary?.total ?? results.length;
    const pendingReviewCount =
      submissionSummary?.pendingReviewCount ??
      results.filter((result) => result.evaluationStatus === "pending_review").length;
    const score = Math.round((submissionSummary?.score ?? (total ? correct / total : 0)) * 100);
    const streakIncreased = streakDelta > 0;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-24 pt-12 text-center">
        <style>{`
          @keyframes practice-confetti-burst {
            0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) scale(0.4); }
            12% { opacity: 1; }
            100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--x), var(--y)) scale(1); }
          }

          @keyframes practice-streak-pop {
            0% { opacity: 0; transform: scale(0.75); }
            70% { opacity: 1; transform: scale(1.08); }
            100% { opacity: 1; transform: scale(1); }
          }

          .practice-confetti-dot {
            animation: practice-confetti-burst 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }

          .practice-streak-pop {
            animation: practice-streak-pop 360ms ease-out forwards;
          }
        `}</style>
        <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-brand-100 dark:bg-brand-950/40">
          <div className="pointer-events-none absolute inset-0">
            {CONFETTI_DOTS.map((dot, index) => (
              <span
                key={`${dot.x}-${dot.y}`}
                className="practice-confetti-dot absolute left-1/2 top-1/2 h-3 w-3 rounded-full opacity-0"
                style={
                  {
                    "--x": dot.x,
                    "--y": dot.y,
                    backgroundColor: dot.color,
                    animationDelay: `${index * 45}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <Trophy size={36} className="relative z-10 text-brand-600" />
        </div>
        {streakIncreased && (
          <div className="practice-streak-pop mb-4 rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700 dark:bg-orange-950/40 dark:text-orange-200">
            {t("practice.done.streakGained", { count: streakDelta })}
          </div>
        )}
        <div className="card animate-slide-up w-full">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{score}%</h1>
          <p className="mb-6 mt-2 text-slate-500 dark:text-slate-400">
            {t("practice.live.scoreLine", { correct, total })}
          </p>
          {pendingReviewCount > 0 && (
            <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {t("practice.live.pendingReviewNoPenalty", { count: pendingReviewCount })}
            </p>
          )}
          {authUser && !streakIncreased && (
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              {t("practice.done.currentStreak")}: <span className="font-semibold text-slate-800 dark:text-slate-100">{authUser.streak}</span>
            </p>
          )}
          <div className="grid w-full gap-2">
            <button className="btn-primary" onClick={() => navigate("/app/roadmap")}>
              {t("practice.live.backToRoadmap")}
            </button>
            <button className="btn-secondary" onClick={() => loadPractice.mutate(practiceMode)}>
              {t("practice.live.generateAnother")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-24 pt-12">
        <EmptyState
          icon={Keyboard}
          title={t("practice.live.emptyTitle")}
          description={t("practice.live.emptyDescription")}
          action={<button className="btn-primary" onClick={() => loadPractice.mutate(practiceMode)}>{t("practice.live.generateTest")}</button>}
        />
      </div>
    );
  }

  const options =
    "options" in currentQuestion && Array.isArray(currentQuestion.options)
      ? currentQuestion.options
      : [];
  const reorderTokens =
    currentQuestion.type === "reorder_words" && Array.isArray(currentQuestion.tokens)
      ? currentQuestion.tokens
      : [];
  const selectedReorderTokens = answerState.selectedTokenIndices
    .map((tokenIndex) => reorderTokens[tokenIndex])
    .filter(Boolean);
  const matchingPairs =
    currentQuestion.type === "matching" && Array.isArray(currentQuestion.pairs)
      ? currentQuestion.pairs
      : [];
  const matchingOptions =
    currentQuestion.type === "matching"
      ? options.length > 0
        ? options
        : matchingPairs.map((pair) => pair.right)
      : [];
  const matchingComplete =
    matchingPairs.length > 0 &&
    matchingPairs.every((pair) => Boolean(answerState.matchingAnswers[pair.left]));

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col px-5 pb-24 pt-8 lg:px-10 lg:pb-10 lg:pt-12">
      <div className="mb-5">
        <div className="mb-2 flex justify-between text-xs font-semibold text-slate-400 dark:text-slate-500">
          <span>
            {currentIdx + 1} / {questions.length} - {typeLabel(currentQuestion, t)}
          </span>
          <span>{t("practice.live.correctSoFar", { count: scoreSoFar })}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-200 dark:bg-slate-800">
          <div
            className="h-full bg-brand-600 transition-all"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1">
        <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <div className="mb-3 flex flex-wrap gap-2">
            {currentQuestion.exerciseMeta && (
              <>
                <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">
                  {currentQuestion.exerciseMeta.skill}
                </span>
                <span className="rounded-full bg-surface-100 px-2 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {currentQuestion.exerciseMeta.templateFamily.replace(/_/g, " ")}
                </span>
              </>
            )}
            {currentQuestion.scriptSupport && (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                {currentQuestion.scriptSupport.scriptStage.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold leading-relaxed text-slate-900 dark:text-slate-100">{currentQuestion.question}</h1>

          {"passage" in currentQuestion && currentQuestion.passage && (
            <p className="mt-4 rounded-2xl bg-surface-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {currentQuestion.passage}
            </p>
          )}
          {"sentence" in currentQuestion && currentQuestion.sentence && (
            <p className="mt-4 rounded-2xl bg-surface-50 p-4 text-base text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {currentQuestion.sentence}
            </p>
          )}
          {"promptText" in currentQuestion && currentQuestion.promptText && (
            <p className="mt-4 rounded-2xl bg-surface-50 p-4 text-2xl font-bold text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              {currentQuestion.promptText}
            </p>
          )}
          {"prompt" in currentQuestion && currentQuestion.prompt && (
            <p className="mt-4 rounded-2xl bg-surface-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {currentQuestion.prompt}
            </p>
          )}
          {"imageUrl" in currentQuestion && currentQuestion.imageUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-surface-50 dark:border-slate-700 dark:bg-slate-800">
              <img src={currentQuestion.imageUrl} alt="" className="h-56 w-full object-cover" />
            </div>
          ) : currentQuestion.type === "image_based" ? (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-surface-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <ImageIcon size={16} className="shrink-0" />
              {t("practice.live.imageUnavailable")}
            </div>
          ) : null}
          {"media" in currentQuestion && currentQuestion.media && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-black">
              <iframe
                src={getYoutubeEmbedUrl(currentQuestion.media.sourceUrl, currentQuestion.media.startSeconds)}
                title={currentQuestion.media.clipTitle}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {"transcriptWithBlank" in currentQuestion && currentQuestion.transcriptWithBlank && (
            <p className="mt-4 rounded-2xl bg-surface-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {currentQuestion.transcriptWithBlank}
            </p>
          )}
        </section>

        {options.length > 0 && currentQuestion.type !== "matching" && currentQuestion.type !== "reorder_words" && (
          <div className="mt-4 space-y-2">
            {options.map((option) => {
              const selected = answerState.selectedOption === option;
              const correctAnswers = answerState.submitted
                ? [
                    answerState.evaluation?.correctAnswer,
                    "correctAnswer" in currentQuestion ? currentQuestion.correctAnswer : undefined,
                    ...("acceptedAnswers" in currentQuestion && Array.isArray(currentQuestion.acceptedAnswers)
                      ? currentQuestion.acceptedAnswers
                      : []),
                  ].filter((answer): answer is string => Boolean(answer))
                : [];
              const isCorrect = correctAnswers.some(
                (answer) => normalizePracticeText(option) === normalizePracticeText(answer)
              );
              const isWrong = answerState.submitted && selected && !isCorrect;
              const optionTone = isCorrect
                ? "border-green-400 bg-green-50 text-green-700 dark:border-green-500/70 dark:bg-green-500/15 dark:text-green-200"
                : isWrong
                  ? "border-red-300 bg-red-50 text-red-600 dark:border-red-500/70 dark:bg-red-500/15 dark:text-red-200"
                  : selected
                    ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
              return (
                <button
                  key={option}
                  disabled={answerState.submitted || isEvaluating}
                  onClick={() => {
                    setAnswerState((state) => ({ ...state, selectedOption: option, value: option }));
                    void submitAnswer(option);
                  }}
                  className={cn(
                    "flex min-h-[52px] w-full items-center justify-between rounded-2xl border px-4 py-3 text-left font-semibold transition",
                    optionTone
                  )}
                >
                  <span>{option}</span>
                  {isCorrect && <CheckCircle2 size={18} />}
                  {isWrong && <XCircle size={18} />}
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === "reorder_words" && (
          <div className="mt-4">
            <div className="mb-3 min-h-[56px] rounded-2xl border border-dashed border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              {selectedReorderTokens.length === 0 ? (
                <span className="text-sm text-slate-400 dark:text-slate-500">{t("practice.live.tapWords")}</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedReorderTokens.map((token, index) => (
                    <button
                      key={`${token}-${index}`}
                      className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700"
                      onClick={() =>
                        setAnswerState((state) => ({
                          ...state,
                          selectedTokenIndices: state.selectedTokenIndices.filter((_, tokenIndex) => tokenIndex !== index),
                        }))
                      }
                    >
                      {token}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {reorderTokens.map((token, index) => (
                <button
                  key={`${token}-${index}`}
                  disabled={answerState.submitted || isEvaluating || answerState.selectedTokenIndices.includes(index)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm font-semibold",
                    answerState.selectedTokenIndices.includes(index)
                      ? "border-slate-100 bg-slate-100 text-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-500"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  )}
                  onClick={() =>
                    setAnswerState((state) => ({
                      ...state,
                      selectedTokenIndices: [...state.selectedTokenIndices, index],
                    }))
                  }
                >
                  {token}
                </button>
              ))}
            </div>
            {!answerState.submitted && (
              <button
                className="btn-primary mt-4 w-full"
                disabled={selectedReorderTokens.length === 0 || isEvaluating}
                onClick={() => void submitAnswer()}
              >
                {isEvaluating ? t("practice.quiz.checkingAnswer") : t("practice.live.checkSentence")}
              </button>
            )}
          </div>
        )}

        {currentQuestion.type === "matching" && (
          <div className="mt-4 rounded-3xl bg-white p-4 shadow-card ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            <div className="grid gap-3">
              {matchingPairs.map((pair) => {
                const selected = answerState.matchingAnswers[pair.left] ?? "";
                const checked = answerState.submitted;
                const correct =
                  normalizePracticeText(selected) === normalizePracticeText(pair.right);
                return (
                <div
                  key={pair.left}
                  className={cn(
                    "grid gap-2 rounded-2xl border bg-surface-50 p-3 sm:grid-cols-[1fr_1.2fr] sm:items-center",
                    checked && correct && "border-green-300 bg-green-50",
                    checked && !correct && "border-red-200 bg-red-50",
                    !checked && "dark:border-slate-800 dark:bg-slate-800"
                  )}
                >
                  <p className="font-bold text-slate-900 dark:text-slate-100">{pair.left}</p>
                  <select
                    className="input min-h-[44px] bg-white dark:bg-slate-900"
                    value={selected}
                    disabled={answerState.submitted || isEvaluating}
                    onChange={(event) =>
                      setAnswerState((state) => ({
                        ...state,
                        matchingAnswers: {
                          ...state.matchingAnswers,
                          [pair.left]: event.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">{t("practice.live.answerPlaceholder")}</option>
                    {matchingOptions.map((option) => (
                      <option key={`${pair.left}-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              );
              })}
            </div>
            {!answerState.submitted && (
              <button
                className="btn-primary mt-4 w-full"
                disabled={!matchingComplete || isEvaluating}
                onClick={() => void submitAnswer()}
              >
                {isEvaluating ? t("practice.quiz.checkingAnswer") : t("practice.live.matched")}
              </button>
            )}
          </div>
        )}

        {options.length === 0 &&
          currentQuestion.type !== "matching" &&
          currentQuestion.type !== "reorder_words" && (
            <div className="mt-4">
              {"rubric" in currentQuestion && Array.isArray(currentQuestion.rubric) && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {currentQuestion.rubric.map((rule) => (
                    <span key={rule} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
                      {rule}
                    </span>
                  ))}
                </div>
              )}
              <textarea
                className="input min-h-[150px] resize-none"
                value={answerState.value}
                disabled={answerState.submitted || isEvaluating}
                onChange={(event) => setAnswerState((state) => ({ ...state, value: event.target.value }))}
                placeholder={t("practice.live.answerPlaceholder")}
              />
              {!answerState.submitted && (
                <button
                  className="btn-primary mt-3 w-full"
                  disabled={!answerState.value.trim() || isEvaluating}
                  onClick={() => void submitAnswer()}
                >
                  {isEvaluating ? t("practice.quiz.checkingAnswer") : t("practice.live.submitAnswer")}
                </button>
              )}
            </div>
          )}

        {answerState.submitted && answerState.evaluation && (
          <div className={cn(
            "mt-4 rounded-2xl border p-4",
            isCorrectEvaluation(answerState.evaluation)
              ? "border-green-200 bg-green-50"
              : isPendingReview(answerState.evaluation)
                ? "border-amber-200 bg-amber-50"
                : "border-red-200 bg-red-50"
          )}>
            <div className="mb-2 flex items-center gap-2">
              {isCorrectEvaluation(answerState.evaluation) ? (
                <CheckCircle2 size={18} className="text-green-600" />
              ) : isPendingReview(answerState.evaluation) ? (
                <AlertCircle size={18} className="text-amber-600" />
              ) : (
                <XCircle size={18} className="text-red-500" />
              )}
              <p
                className={cn(
                  "font-bold",
                  isCorrectEvaluation(answerState.evaluation)
                    ? "text-green-700"
                    : isPendingReview(answerState.evaluation)
                      ? "text-amber-800"
                      : "text-red-600"
                )}
              >
                {isCorrectEvaluation(answerState.evaluation)
                  ? t("practice.live.correct")
                  : isPendingReview(answerState.evaluation)
                    ? t("practice.live.pendingReview")
                    : t("practice.live.needsReview")}
              </p>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200">{answerState.evaluation.feedback}</p>
            {!isCorrectEvaluation(answerState.evaluation) &&
              !isPendingReview(answerState.evaluation) &&
              answerState.evaluation.correctAnswer && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t("practice.live.answer")}: <span className="font-semibold text-slate-900 dark:text-slate-100">{answerState.evaluation.correctAnswer}</span>
              </p>
            )}
            {answerState.evaluation.acceptedEquivalent && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t("practice.quiz.acceptedEquivalent")}: <span className="font-semibold text-slate-900 dark:text-slate-100">{answerState.evaluation.acceptedEquivalent}</span>
              </p>
            )}
            {answerState.evaluation.correctedAnswer && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t("practice.quiz.suggestedFix")}: <span className="font-semibold text-slate-900 dark:text-slate-100">{answerState.evaluation.correctedAnswer}</span>
              </p>
            )}
            {answerState.evaluation.ruleChecks && (
              <div className="mt-3 space-y-2 rounded-xl bg-white/70 p-3 text-sm text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">
                {answerState.evaluation.ruleChecks.map((rule) => (
                  <p key={rule.label}>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{rule.label}:</span> {rule.detail}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {answerState.submitted && (
        <button
          className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2"
          disabled={isEvaluating || submitSession.isPending}
          onClick={() => void nextQuestion()}
        >
          {currentIdx + 1 >= questions.length ? t("practice.quiz.seeResults") : t("common.next")}
          <ChevronRight size={18} />
        </button>
      )}

    </div>
  );
}
