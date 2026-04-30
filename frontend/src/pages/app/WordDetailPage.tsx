import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, Check, AlertCircle, Sparkles, Volume2 } from "lucide-react";
import { useState, useEffect } from "react";
import { wordsApi } from "@/api/words";
import { aiApi } from "@/api/practice";
import { useAuthStore } from "@/store/authStore";
import LevelBadge from "@/components/ui/LevelBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useSaveWord, useMarkLearned, useMarkDifficult } from "@/hooks/useWords";
import { useT } from "@/i18n";
import { getWordId } from "@/utils/word";
import { getNativeMeaning } from "@/utils/wordMeaning";
import { getTopicLabel } from "@/utils/topic";

export default function WordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [aiTab, setAiTab] = useState<"examples" | "explain" | "similar" | null>(null);

  const {
    data: word,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["word", id],
    queryFn: async () => {
      const res = await wordsApi.getWordById(id!);
      return res.data.data;
    },
    enabled: !!id,
    retry: 1,
  });

  const saveWord = useSaveWord();
  const markLearned = useMarkLearned();
  const markDifficult = useMarkDifficult();

  const {
    data: aiExamples,
    isPending: loadingExamples,
    mutate: fetchExamples,
  } = useMutation({
    mutationFn: () => aiApi.exampleSentences(id!),
  });

  const {
    data: aiExplanation,
    isPending: loadingExplanation,
    mutate: fetchExplanation,
  } = useMutation({
    mutationFn: () => aiApi.explainWord(id!),
  });

  const {
    data: similar,
    isPending: loadingSimilar,
    mutate: fetchSimilar,
  } = useMutation({
    mutationFn: () => aiApi.similarWords(id!),
  });

  // Must be before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (id && word) fetchExplanation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, word]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !word) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle size={40} className="text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-slate-700 mb-1">{t("common.error")}</h2>
        <p className="text-slate-400 text-sm mb-2">{t("word.loadError")}</p>
        {error instanceof Error && (
          <p className="text-xs text-slate-400 mb-6">{error.message}</p>
        )}
        <button
          onClick={() => navigate(-1)}
          className="btn-primary px-6 py-2.5 text-sm"
        >
          {t("common.back")}
        </button>
      </div>
    );
  }

  const sentences: string[] = aiExamples?.data?.data?.sentences ?? [];
  const explanation = aiExplanation?.data?.data;
  const tips: string[] = explanation?.tips ?? [];
  const similarWords = similar?.data?.data ?? [];
  const wordId = getWordId(word);
  const nativeMeaning = getNativeMeaning(word);

  return (
    <div className="min-h-dvh bg-surface-50 pb-8">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-6 shadow-card">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 mb-4">
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <LevelBadge level={word.cefrLevel} />
              {word.topic && (
                <span className="text-xs text-slate-400 capitalize bg-surface-100 px-2 py-0.5 rounded-full">
                  {getTopicLabel(word.topic, t)}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-1">{word.word}</h1>
            <p className="text-slate-500 text-sm font-medium capitalize">
              {word.partOfSpeech ? word.partOfSpeech.toLowerCase() : ""}
            </p>
            {word.pronunciation && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Volume2 size={14} className="text-slate-400" />
                <span className="text-sm text-slate-400 font-mono">{word.pronunciation}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => saveWord.mutate(wordId)}
              disabled={!wordId || saveWord.isPending}
              className="w-11 h-11 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 hover:bg-brand-100 transition-colors"
              title={t("word.save")}
            >
              <Bookmark size={18} />
            </button>
            <button
              onClick={() => markLearned.mutate(wordId)}
              disabled={!wordId || markLearned.isPending}
              className="w-11 h-11 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"
              title={t("word.markLearned")}
            >
              <Check size={18} />
            </button>
            <button
              onClick={() => markDifficult.mutate(wordId)}
              disabled={!wordId || markDifficult.isPending}
              className="w-11 h-11 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors"
              title={t("word.markDifficult")}
            >
              <AlertCircle size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-4">
        {/* Definition */}
        <div className="card">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {t("word.definition")}
          </h3>
          {loadingExplanation ? (
            <LoadingSpinner className="py-2" />
          ) : explanation?.simpleExplanation ? (
            <p className="text-slate-700 leading-relaxed">{explanation.simpleExplanation}</p>
          ) : (
            <p className="text-slate-700 leading-relaxed">{nativeMeaning}</p>
          )}
        </div>

        {/* Example */}
        <div className="card">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {t("word.example")}
          </h3>
          <p className="text-slate-700 italic">"{word.exampleSentence}"</p>
        </div>

        {/* Synonyms & Collocations */}
        {((word.synonyms && word.synonyms.length > 0) ||
          (word.collocations && word.collocations.length > 0)) && (
          <div className="card space-y-3">
            {word.synonyms && word.synonyms.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {t("word.synonyms")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {word.synonyms.map((s) => (
                    <span
                      key={s}
                      className="bg-brand-50 text-brand-700 text-sm px-3 py-1 rounded-full font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {word.collocations && word.collocations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {t("word.collocations")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {word.collocations.map((c) => (
                    <span key={c} className="bg-surface-100 text-slate-600 text-sm px-3 py-1 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Features */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-slate-700">{t("word.aiLearningTools")}</h3>
            <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">
              {user?.currentLevel}
            </span>
          </div>

          <div className="flex gap-2 flex-wrap mb-4">
            {[
              { key: "examples" as const, label: t("word.aiExamples"), action: fetchExamples },
              { key: "explain" as const, label: t("word.aiExplanation"), action: fetchExplanation },
              { key: "similar" as const, label: t("word.similarWords"), action: fetchSimilar },
            ].map(({ key, label, action }) => (
              <button
                key={key}
                onClick={() => {
                  setAiTab(key);
                  action();
                }}
                className={`text-sm font-medium px-3.5 py-2 rounded-xl transition-all ${
                  aiTab === key
                    ? "bg-brand-600 text-white"
                    : "bg-surface-100 text-slate-600 hover:bg-brand-50 hover:text-brand-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* AI output */}
          {aiTab === "examples" && (
            loadingExamples ? (
              <LoadingSpinner className="py-4" />
            ) : sentences.length > 0 ? (
              <ul className="space-y-2">
                {sentences.map((s, i) => (
                  <li key={i} className="text-sm text-slate-600 italic border-l-2 border-brand-200 pl-3">
                    "{s}"
                  </li>
                ))}
              </ul>
            ) : aiTab === "examples" && !loadingExamples ? (
              <p className="text-sm text-slate-400">{t("word.noExamples")}</p>
            ) : null
          )}

          {aiTab === "explain" && (
            loadingExplanation ? (
              <LoadingSpinner className="py-4" />
            ) : tips.length > 0 ? (
              <ul className="space-y-1.5">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-500">
                    <span className="text-brand-500 font-bold mt-0.5">-</span>
                    {tip}
                  </li>
                ))}
              </ul>
            ) : aiTab === "explain" && !loadingExplanation ? (
              <p className="text-sm text-slate-400">{t("word.noTips")}</p>
            ) : null
          )}

          {aiTab === "similar" && (
            loadingSimilar ? (
              <LoadingSpinner className="py-4" />
            ) : similarWords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {similarWords.map((w) => (
                  <button
                    key={getWordId(w) || w.word}
                    onClick={() => {
                      const similarWordId = getWordId(w);
                      if (!similarWordId) return;
                      navigate(`/app/words/${similarWordId}`);
                    }}
                    className="bg-surface-100 text-slate-700 text-sm px-3.5 py-2 rounded-xl font-medium hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    {w.word}
                  </button>
                ))}
              </div>
            ) : aiTab === "similar" && !loadingSimilar ? (
              <p className="text-sm text-slate-400">{t("word.noSimilar")}</p>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
