import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { wordsApi } from "@/api/words";
import { useAuthStore } from "@/store/authStore";
import WordCard from "@/components/features/words/WordCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import { useT } from "@/i18n";
import { cn } from "@/utils/cn";
import type { CefrLevel } from "@/types";
import { DISCOVER_TOPIC_KEYS } from "@/constants/topics";
import { getTopicLabel } from "@/utils/topic";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function DiscoverPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<CefrLevel | "">("");
  const [topic, setTopic] = useState(() => searchParams.get("topic") ?? "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const urlTopic = searchParams.get("topic");
    if (urlTopic !== null) {
      setTopic(urlTopic);
      setPage(1);
    }
  }, [searchParams]);

  const isSearching = search.length >= 2;

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["search", search],
    queryFn: async () => {
      const res = await wordsApi.searchWords(search);
      return res.data.data;
    },
    enabled: isSearching,
  });

  const { data: wordList, isLoading: loading } = useQuery({
    queryKey: ["words", { level, topic, page }],
    queryFn: async () => {
      const res = await wordsApi.getWords({
        level: (level || user?.currentLevel) as CefrLevel,
        topic: topic || undefined,
        page,
        limit: 15,
      });
      return res.data.data;
    },
    enabled: !isSearching,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:px-10 lg:pb-6 lg:pt-12">
      <div className="mb-5 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-5 text-white">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-brand-100">
          {t("discover.hero.eyebrow")}
        </p>
        <h1 className="mb-2 text-2xl font-bold lg:text-3xl">{t("discover.title")}</h1>
        <p className="mb-4 max-w-2xl text-sm text-brand-100">
          {t("discover.hero.description")}
        </p>
        <button
          onClick={() => navigate("/app/roadmap")}
          className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700"
        >
          {t("discover.hero.cta")}
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("discover.searchPlaceholder")}
          className="input h-11 pl-11 text-sm"
        />
      </div>

      <div className="lg:flex lg:gap-8">
        {!isSearching && (
          <aside className="mb-5 min-w-0 lg:mb-0 lg:w-64 lg:shrink-0">
            <div className="rounded-3xl border border-surface-200 bg-white p-4 shadow-card lg:sticky lg:top-8">
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("discover.filterLevel")}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
                  <button
                    onClick={() => {
                      setLevel("");
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-2xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all",
                      !level
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-surface-200 bg-white text-slate-600 hover:border-brand-300"
                    )}
                  >
                    {t("discover.myLevel")}
                  </button>
                  {LEVELS.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setLevel(item === level ? "" : item);
                        setPage(1);
                      }}
                      className={cn(
                        "rounded-2xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all",
                        level === item
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-surface-200 bg-white text-slate-600 hover:border-brand-300"
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("discover.filterTopic")}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <button
                    onClick={() => {
                      setTopic("");
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-2xl border px-3.5 py-2.5 text-left text-xs font-medium transition-all",
                      !topic
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-surface-200 bg-white text-slate-500 hover:border-slate-400"
                    )}
                  >
                    {t("discover.allTopics")}
                  </button>
                  {DISCOVER_TOPIC_KEYS.map((topicKey) => (
                    <button
                      key={topicKey}
                      onClick={() => {
                        setTopic(topicKey === topic ? "" : topicKey);
                        setPage(1);
                      }}
                      className={cn(
                        "rounded-2xl border px-3.5 py-2.5 text-left text-xs font-medium transition-all",
                        topic === topicKey
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-surface-200 bg-white text-slate-500 hover:border-slate-400"
                      )}
                    >
                      {getTopicLabel(topicKey, t)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1">
          {isSearching ? (
            searching ? (
              <LoadingSpinner className="py-10" />
            ) : searchResults && searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((word) => (
                  <WordCard key={word.id} word={word} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Search}
                title={t("discover.noResults")}
                description={t("discover.noResultsDesc", { query: search })}
              />
            )
          ) : loading ? (
            <LoadingSpinner className="py-10" />
          ) : wordList?.words && wordList.words.length > 0 ? (
            <>
              <div className="space-y-3">
                {wordList.words.map((word) => (
                  <WordCard key={word.id} word={word} />
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 py-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-brand-600 transition-colors active:bg-brand-50 disabled:text-slate-300"
                >
                  {t("discover.pagination.previous")}
                </button>
                <span className="text-sm text-slate-500">
                  {page} / {wordList.pages}
                </span>
                <button
                  disabled={page >= wordList.pages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-brand-600 transition-colors active:bg-brand-50 disabled:text-slate-300"
                >
                  {t("discover.pagination.next")}
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              icon={SlidersHorizontal}
              title={t("discover.noWordsFound")}
              description={t("discover.noWordsDesc")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
