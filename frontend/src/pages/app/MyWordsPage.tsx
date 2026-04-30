import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, Trash2 } from "lucide-react";
import { useMyWords, useRemoveWord } from "@/hooks/useWords";
import LevelBadge from "@/components/ui/LevelBadge";
import WordStatusBadge from "@/components/ui/WordStatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import { useT } from "@/i18n";
import { cn } from "@/utils/cn";
import type { WordStatus } from "@/types";
import { getWordId } from "@/utils/word";
import { getNativeMeaning } from "@/utils/wordMeaning";

export default function MyWordsPage() {
  const navigate = useNavigate();
  const t = useT();
  const [filter, setFilter] = useState<WordStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const removeWord = useRemoveWord();

  const { data: words, isLoading } = useMyWords(filter === "ALL" ? undefined : filter);

  const filtered = words?.filter((entry) =>
    search ? entry.word.word.toLowerCase().includes(search.toLowerCase()) : true
  );

  const statusFilters: Array<{ value: WordStatus | "ALL"; label: string }> = [
    { value: "ALL", label: t("myWords.filters.all") },
    { value: "SAVED", label: t("myWords.filters.saved") },
    { value: "LEARNING", label: t("myWords.filters.learning") },
    { value: "LEARNED", label: t("myWords.filters.learned") },
    { value: "DIFFICULT", label: t("myWords.filters.difficult") },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:px-10 lg:pb-6 lg:pt-12">
      <div className="mb-5 rounded-3xl bg-slate-900 px-5 py-5 text-white">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
          {t("myWords.hero.eyebrow")}
        </p>
        <h1 className="mb-2 text-2xl font-bold lg:text-3xl">{t("myWords.title")}</h1>
        <p className="text-sm text-slate-300">{t("myWords.hero.description")}</p>
      </div>

      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("myWords.searchPlaceholder")}
          className="input h-11 pl-11 text-sm"
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {statusFilters.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-2xl border px-4 py-2.5 text-left text-xs font-semibold transition-all",
              filter === value
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-surface-200 bg-white text-slate-500 active:bg-slate-50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-10" />
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {filtered.map((entry) => {
            const nativeMeaning = getNativeMeaning(entry.word);
            const wordId = getWordId(entry.word);

            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-3xl border border-surface-200 bg-white px-4 py-4 transition-shadow hover:shadow-soft active:bg-surface-50"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    if (wordId) {
                      navigate(`/app/words/${wordId}`);
                    }
                  }}
                >
                  <div className="mb-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-slate-800">{entry.word.word}</span>
                    <LevelBadge level={entry.word.cefrLevel} />
                    <WordStatusBadge status={entry.status} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 pr-2 text-sm text-slate-500">{nativeMeaning}</p>
                  {entry.timesReviewed > 0 && (
                    <p className="mt-1 text-xs text-slate-400">
                      {entry.timesReviewed}{" "}
                      {entry.timesReviewed !== 1 ? t("myWords.reviews") : t("myWords.review")}
                    </p>
                  )}
                </button>

                <button
                  onClick={() => removeWord.mutate(entry.wordId)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400 active:bg-red-100"
                  aria-label={t("word.removeWord")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title={t("myWords.empty.title")}
          description={t("myWords.empty.description")}
          action={
            <button
              onClick={() => navigate("/app/discover")}
              className="btn-primary px-5 py-3 text-sm"
            >
              {t("myWords.empty.button")}
            </button>
          }
        />
      )}
    </div>
  );
}
