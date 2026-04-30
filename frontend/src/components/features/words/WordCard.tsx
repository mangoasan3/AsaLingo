import { useNavigate } from "react-router-dom";
import { Bookmark, Check, Volume2 } from "lucide-react";
import type { VocabularyWord } from "@/types";
import LevelBadge from "@/components/ui/LevelBadge";
import { useSaveWord, useMarkLearned } from "@/hooks/useWords";
import { cn } from "@/utils/cn";
import { getWordId } from "@/utils/word";
import { getNativeMeaning } from "@/utils/wordMeaning";
import { useT } from "@/i18n";
import { getTopicLabel } from "@/utils/topic";

interface Props {
  word: VocabularyWord;
  showActions?: boolean;
}

export default function WordCard({ word, showActions = true }: Props) {
  const navigate = useNavigate();
  const t = useT();
  const saveWord = useSaveWord();
  const markLearned = useMarkLearned();
  const wordId = getWordId(word);
  const nativeMeaning = getNativeMeaning(word);

  return (
    <div
      className="card cursor-pointer hover:shadow-soft transition-shadow duration-200"
      onClick={() => {
        if (!wordId) return;
        navigate(`/app/words/${wordId}`);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <LevelBadge level={word.cefrLevel} />
            {word.topic && (
              <span className="text-xs capitalize text-slate-400 dark:text-slate-500">{getTopicLabel(word.topic, t)}</span>
            )}
          </div>
          <h3 className="mb-0.5 text-xl font-bold text-slate-800 dark:text-slate-100">{word.word}</h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{word.partOfSpeech.toLowerCase()}</p>
          <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{nativeMeaning}</p>
          {word.pronunciation && (
            <div className="mt-1.5 flex items-center gap-1">
              <Volume2 size={12} className="text-slate-400 dark:text-slate-500" />
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{word.pronunciation}</span>
            </div>
          )}
        </div>

        {showActions && (
          <div
            className="flex flex-col gap-2 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => saveWord.mutate(wordId)}
              disabled={!wordId || saveWord.isPending}
              className={cn(
                "w-9 h-9 rounded-2xl flex items-center justify-center transition-colors",
                "bg-surface-100 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-brand-950/40 dark:hover:text-brand-200"
              )}
            >
              <Bookmark size={16} />
            </button>
            <button
              onClick={() => markLearned.mutate(wordId)}
              disabled={!wordId || markLearned.isPending}
              className={cn(
                "w-9 h-9 rounded-2xl flex items-center justify-center transition-colors",
                "bg-surface-100 text-slate-400 hover:bg-green-50 hover:text-green-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-green-950/40 dark:hover:text-green-300"
              )}
            >
              <Check size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-surface-100 pt-3 dark:border-slate-800">
        <p className="line-clamp-1 text-xs italic text-slate-400 dark:text-slate-500">"{word.exampleSentence}"</p>
      </div>
    </div>
  );
}
