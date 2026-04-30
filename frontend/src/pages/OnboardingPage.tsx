import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardCheck,
  PenLine,
  Sparkles,
} from "lucide-react";
import { placementApi } from "@/api/placement";
import { useT } from "@/i18n";
import toast from "@/lib/toast";
import { useAuthStore } from "@/store/authStore";
import { useLocaleStore } from "@/store/localeStore";
import { getLanguageLabel, LANGUAGE_OPTIONS } from "@/utils/language";
import { ONBOARDING_TOPIC_KEYS, RELATED_TOPIC_GROUPS, type TopicKey } from "@/constants/topics";
import { getTopicLabel } from "@/utils/topic";
import { cn } from "@/utils/cn";
import type { CefrLevel, ContentStyle, PlacementItem, PlacementResult } from "@/types";

type Screen = "setup" | "placement" | "manual" | "result";

const MAX_INTERESTS = 12;

const levels: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const contentStyles: ContentStyle[] = ["balanced", "playful", "practical", "academic", "challenge"];

function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = useT();
  const { setUser } = useAuthStore();
  const locale = useLocaleStore((state) => state.locale);
  const setLocaleFromNativeLanguage = useLocaleStore((state) => state.setLocaleFromNativeLanguage);

  const [screen, setScreen] = useState<Screen>("setup");
  const [step, setStep] = useState(0);
  const [nativeLanguage, setNativeLanguage] = useState("en");
  const [studyLanguage, setStudyLanguage] = useState("ja");
  const [interests, setInterests] = useState<string[]>(["anime", "gaming"]);
  const [learningGoal, setLearningGoal] = useState("");
  const [preferredContentStyle, setPreferredContentStyle] = useState<ContentStyle>("balanced");
  const [manualLevel, setManualLevel] = useState<CefrLevel>("A1");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [placementItem, setPlacementItem] = useState<PlacementItem | null>(null);
  const [answer, setAnswer] = useState("");
  const [lastEvaluation, setLastEvaluation] = useState<{ correct: boolean; score: number; feedback: string } | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);

  const relatedInterests = useMemo(
    () =>
      Array.from(
        new Set(interests.flatMap((interest) => RELATED_TOPIC_GROUPS[interest as TopicKey] ?? []))
      ).filter((topic) => !interests.includes(topic)),
    [interests]
  );

  const setupProgress = ((step + 1) / 4) * 100;

  const startPlacement = useMutation({
    mutationFn: () =>
      placementApi.start({
        studyLanguage,
        nativeLanguage,
        interests,
        learningGoal,
        preferredContentStyle,
      }),
    onSuccess: async (res) => {
      const session = res.data.data;
      const id = session.id || session._id;
      if (!id) {
        toast.error(t("onboarding.errors.sessionMissing"));
        return;
      }
      setSessionId(id);
      setScreen("placement");
      await loadNextItem.mutateAsync(id);
    },
    onError: () => {
      toast.error(t("onboarding.errors.startPlacement"));
    },
  });

  const loadNextItem = useMutation({
    mutationFn: (id: string) => placementApi.next(id),
    onSuccess: (res) => {
      const payload = res.data.data;
      if (payload.complete) {
        setPlacementItem(null);
        return;
      }
      setPlacementItem(payload.item ?? null);
      setAnswer("");
      setLastEvaluation(null);
    },
  });

  const submitAnswer = useMutation({
    mutationFn: () => {
      if (!sessionId || !placementItem) throw new Error("No active placement item");
      return placementApi.submit(sessionId, { itemId: placementItem.itemId, answer });
    },
    onSuccess: (res) => {
      setLastEvaluation(res.data.data.evaluation);
    },
    onError: () => {
      toast.error(t("onboarding.errors.checkAnswer"));
    },
  });

  const finishPlacement = useMutation({
    mutationFn: () => {
      if (!sessionId) throw new Error("No active placement session");
      return placementApi.finish(sessionId);
    },
    onSuccess: (res) => {
      const payload = res.data.data;
      setResult(payload.result);
      setUser(payload.user);
      queryClient.setQueryData(["me"], payload.user);
      setScreen("result");
    },
    onError: () => {
      toast.error(t("onboarding.errors.finishPlacement"));
    },
  });

  const manualPlacement = useMutation({
    mutationFn: () =>
      placementApi.manual({
        studyLanguage,
        nativeLanguage,
        currentLevel: manualLevel,
        interests,
        learningGoal,
        preferredContentStyle,
      }),
    onSuccess: (res) => {
      const payload = res.data.data;
      setResult(payload.result);
      setUser(payload.user);
      queryClient.setQueryData(["me"], payload.user);
      setScreen("result");
    },
    onError: () => {
      toast.error(t("onboarding.errors.manualPlacement"));
    },
  });

  const toggleInterest = (interest: string) => {
    setInterests((current) => {
      if (current.includes(interest)) return current.filter((item) => item !== interest);
      if (current.length >= MAX_INTERESTS) {
        toast.error(t("onboarding.errors.maxInterests", { count: MAX_INTERESTS }));
        return current;
      }
      return [...current, interest];
    });
  };

  const canContinueSetup =
    step === 0
      ? nativeLanguage && studyLanguage
      : step === 1
        ? interests.length > 0
        : step === 2
          ? learningGoal.trim().length > 0
          : true;

  const nextPlacementAction = async () => {
    if (!sessionId) return;
    if (lastEvaluation) {
      await loadNextItem.mutateAsync(sessionId);
      return;
    }
    if (!placementItem) {
      finishPlacement.mutate();
    }
  };

  const finishDisabled = finishPlacement.isPending || submitAnswer.isPending;

  return (
    <div className="min-h-dvh bg-surface-50">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 lg:px-10 lg:py-10">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <img src="/app-icon.png" alt={t("common.appName")} className="h-full w-full rounded-2xl object-cover" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">
                {t("onboarding.header.eyebrow")}
              </p>
              <h1 className="text-xl font-bold text-slate-900">{t("onboarding.header.title")}</h1>
            </div>
          </div>
          {screen !== "setup" && screen !== "result" && (
            <button
              className="btn-ghost inline-flex items-center gap-2"
              onClick={() => {
                setScreen("setup");
                setStep(3);
              }}
            >
              <ArrowLeft size={16} />
              {t("common.back")}
            </button>
          )}
        </div>

        {screen === "setup" && (
          <div className="grid flex-1 gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-card">
              <div className="mb-5 flex items-center gap-2 text-brand-200">
                <Sparkles size={18} />
                <span className="text-sm font-semibold">{t("onboarding.setup.badge")}</span>
              </div>
              <h2 className="mb-3 text-3xl font-bold">{t("onboarding.setup.title")}</h2>
              <p className="text-sm leading-relaxed text-slate-300">
                {t("onboarding.setup.description")}
              </p>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-brand-400 transition-all" style={{ width: `${setupProgress}%` }} />
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
              {step === 0 && (
                <div>
                  <h2 className="mb-1 text-2xl font-bold text-slate-900">{t("onboarding.setup.languagesTitle")}</h2>
                  <p className="mb-5 text-sm text-slate-500">{t("onboarding.setup.languagesSubtitle")}</p>
                  <div className="mb-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("onboarding.setup.nativeLabel")}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {LANGUAGE_OPTIONS.map(({ code }) => (
                        <button
                          key={code}
                          onClick={() => {
                            setNativeLanguage(code);
                            setLocaleFromNativeLanguage(code);
                          }}
                          className={cn(
                            "rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                            nativeLanguage === code
                              ? "border-brand-400 bg-brand-50 text-brand-700"
                              : "border-slate-200 text-slate-600"
                          )}
                        >
                          {getLanguageLabel(code, locale)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("onboarding.setup.studyLabel")}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {LANGUAGE_OPTIONS.map(({ code }) => (
                        <button
                          key={code}
                          onClick={() => setStudyLanguage(code)}
                          className={cn(
                            "rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                            studyLanguage === code
                              ? "border-brand-400 bg-brand-50 text-brand-700"
                              : "border-slate-200 text-slate-600"
                          )}
                        >
                          {getLanguageLabel(code, locale)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="mb-1 text-2xl font-bold text-slate-900">{t("onboarding.interests.title")}</h2>
                  <p className="mb-5 text-sm text-slate-500">{t("onboarding.interests.subtitle")}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ONBOARDING_TOPIC_KEYS.map((interest) => (
                      <button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={cn(
                          "min-h-[44px] rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition",
                          interests.includes(interest)
                            ? "border-brand-400 bg-brand-50 text-brand-700"
                            : "border-slate-200 text-slate-600"
                      )}
                    >
                        {getTopicLabel(interest, t)}
                      </button>
                    ))}
                  </div>
                  {relatedInterests.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {relatedInterests.slice(0, 8).map((interest) => (
                        <button
                          key={interest}
                          onClick={() => toggleInterest(interest)}
                          className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
                        >
                          + {getTopicLabel(interest, t)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="mb-1 text-2xl font-bold text-slate-900">{t("onboarding.setup.goalTitle")}</h2>
                  <p className="mb-5 text-sm text-slate-500">{t("onboarding.setup.goalSubtitle")}</p>
                  <textarea
                    className="input min-h-[120px] resize-none"
                    value={learningGoal}
                    onChange={(event) => setLearningGoal(event.target.value)}
                    placeholder={t("onboarding.setup.goalPlaceholder")}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {contentStyles.map((style) => (
                      <button
                        key={style}
                        onClick={() => setPreferredContentStyle(style)}
                        className={cn(
                          "rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                          preferredContentStyle === style
                            ? "border-brand-400 bg-brand-50 text-brand-700"
                            : "border-slate-200 text-slate-600"
                        )}
                      >
                        {t(`onboarding.contentStyle.${style}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="mb-1 text-2xl font-bold text-slate-900">{t("onboarding.placement.readyTitle")}</h2>
                  <p className="mb-5 text-sm text-slate-500">{t("onboarding.placement.readySubtitle")}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => startPlacement.mutate()}
                      disabled={startPlacement.isPending}
                      className="rounded-3xl border-2 border-brand-300 bg-brand-50 p-5 text-left transition hover:border-brand-500"
                    >
                      <ClipboardCheck className="mb-3 text-brand-600" size={24} />
                      <p className="font-bold text-slate-900">{t("onboarding.placement.takeTest")}</p>
                      <p className="mt-1 text-sm text-slate-500">{t("onboarding.placement.takeTestDescription")}</p>
                    </button>
                    <button
                      onClick={() => setScreen("manual")}
                      className="rounded-3xl border-2 border-slate-200 bg-white p-5 text-left transition hover:border-slate-400"
                    >
                      <PenLine className="mb-3 text-slate-600" size={24} />
                      <p className="font-bold text-slate-900">{t("onboarding.placement.chooseManual")}</p>
                      <p className="mt-1 text-sm text-slate-500">{t("onboarding.placement.chooseManualDescription")}</p>
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-2">
                {step > 0 && (
                  <button className="btn-secondary" onClick={() => setStep((current) => current - 1)}>
                    {t("common.back")}
                  </button>
                )}
                {step < 3 && (
                  <button
                    className="btn-primary ml-auto inline-flex items-center gap-2"
                    disabled={!canContinueSetup}
                    onClick={() => setStep((current) => current + 1)}
                  >
                    {t("common.continue")}
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {screen === "placement" && (
          <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">
                {t("onboarding.placement.title")}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-brand-600 transition-all"
                  style={{
                    width: placementItem
                      ? `${Math.round((placementItem.progress.answered / placementItem.progress.target) * 100)}%`
                      : "100%",
                  }}
                />
              </div>
            </div>

            {loadNextItem.isPending && <p className="py-10 text-center text-sm text-slate-500">{t("onboarding.placement.loadingItem")}</p>}

            {placementItem && !loadNextItem.isPending && (
              <div>
                <div className="mb-5 rounded-2xl bg-surface-50 p-4">
                  <div className="mb-2 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-white px-2 py-1 text-brand-600">{placementItem.skill}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-slate-500">
                      {placementItem.cefrLevel} · {t("onboarding.placement.difficulty", { value: placementItem.difficulty })}
                    </span>
                  </div>
                  {placementItem.passage && (
                    <p className="mb-3 rounded-xl bg-white p-3 text-sm leading-relaxed text-slate-600">
                      {placementItem.passage}
                    </p>
                  )}
                  <h2 className="text-xl font-bold leading-relaxed text-slate-900">{placementItem.prompt}</h2>
                </div>

                {placementItem.choices.length > 0 ? (
                  <div className="space-y-2">
                    {placementItem.choices.map((choice) => {
                      const selected = answer === choice;
                      const revealedCorrect = lastEvaluation && lastEvaluation.correct && normalizeAnswer(answer) === normalizeAnswer(choice);
                      return (
                        <button
                          key={choice}
                          disabled={Boolean(lastEvaluation)}
                          onClick={() => setAnswer(choice)}
                          className={cn(
                            "flex min-h-[52px] w-full items-center justify-between rounded-2xl border px-4 py-3 text-left font-semibold transition",
                            selected
                              ? "border-brand-400 bg-brand-50 text-brand-700"
                              : "border-slate-200 text-slate-700",
                            revealedCorrect && "border-green-400 bg-green-50 text-green-700"
                          )}
                        >
                          {choice}
                          {revealedCorrect && <Check size={18} />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    className="input min-h-[140px] resize-none"
                    value={answer}
                    disabled={Boolean(lastEvaluation)}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder={t("onboarding.placement.answerPlaceholder")}
                  />
                )}

                {lastEvaluation && (
                  <div className={cn(
                    "mt-4 rounded-2xl border p-4 text-sm",
                    lastEvaluation.correct ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"
                  )}>
                    {lastEvaluation.feedback} {t("onboarding.placement.scoreSignal", { value: Math.round(lastEvaluation.score * 100) })}
                  </div>
                )}

                <div className="mt-5 flex gap-2">
                  <button className="btn-secondary" disabled={finishDisabled} onClick={() => finishPlacement.mutate()}>
                    {t("onboarding.placement.finishNow")}
                  </button>
                  {!lastEvaluation ? (
                    <button
                      className="btn-primary ml-auto"
                      disabled={!answer.trim() || submitAnswer.isPending}
                      onClick={() => submitAnswer.mutate()}
                    >
                      {submitAnswer.isPending ? t("onboarding.placement.checking") : t("onboarding.placement.submitAnswer")}
                    </button>
                  ) : (
                    <button className="btn-primary ml-auto" onClick={nextPlacementAction}>
                      {t("onboarding.placement.nextItem")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {!placementItem && !loadNextItem.isPending && (
              <div className="py-10 text-center">
                <ClipboardCheck className="mx-auto mb-4 text-brand-600" size={38} />
                <h2 className="mb-2 text-2xl font-bold text-slate-900">{t("onboarding.placement.readyToFinish")}</h2>
                <button className="btn-primary mt-3" disabled={finishPlacement.isPending} onClick={() => finishPlacement.mutate()}>
                  {finishPlacement.isPending ? t("onboarding.placement.computingProfile") : t("onboarding.placement.computeProfile")}
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "manual" && (
          <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-100">
            <h2 className="mb-1 text-2xl font-bold text-slate-900">{t("onboarding.manual.title")}</h2>
            <p className="mb-5 text-sm text-slate-500">{t("onboarding.manual.subtitle")}</p>
            <div className="space-y-2">
              {levels.map((level) => (
                <button
                  key={level}
                  onClick={() => setManualLevel(level)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                    manualLevel === level ? "border-brand-400 bg-brand-50" : "border-slate-200"
                  )}
                >
                  <span>
                    <span className="font-bold text-slate-900">{level}</span>
                    <span className="ml-3 text-sm text-slate-500">{t(`onboarding.manual.levels.${level.toLowerCase()}`)}</span>
                  </span>
                  {manualLevel === level && <Check size={18} className="text-brand-600" />}
                </button>
              ))}
            </div>
            <button
              className="btn-primary mt-5 w-full"
              disabled={manualPlacement.isPending}
              onClick={() => manualPlacement.mutate()}
            >
              {manualPlacement.isPending ? t("common.loading") : t("onboarding.manual.start")}
            </button>
          </div>
        )}

        {screen === "result" && result && (
          <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-6 text-center shadow-card ring-1 ring-slate-100">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-100">
              <ClipboardCheck className="text-brand-600" size={30} />
            </div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">
              {t("onboarding.result.profileCreated")}
            </p>
            <h2 className="mb-2 text-3xl font-bold text-slate-900">
              {result.estimatedLevel} · {result.learnerStage.replace(/_/g, " ")}
            </h2>
            <p className="mx-auto mb-5 max-w-md text-sm text-slate-500">
              {t("onboarding.result.summary", {
                confidence: Math.round(result.confidence * 100),
                scriptStage: result.scriptStage.replace(/_/g, " "),
              })}
            </p>
            <div className="mb-5 grid grid-cols-2 gap-2 text-left sm:grid-cols-5">
              {Object.entries(result.subskillProfile)
                .filter(([key]) => key !== "updatedAt")
                .map(([skill, score]) => (
                  <div key={skill} className="rounded-2xl bg-surface-50 p-3">
                    <p className="text-xs font-semibold capitalize text-slate-500">{skill}</p>
                    <p className="text-lg font-bold text-slate-900">{Math.round(Number(score) * 100)}%</p>
                  </div>
                ))}
            </div>
            <button className="btn-primary w-full" onClick={() => navigate("/app", { replace: true })}>
              {t("onboarding.result.continue")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
