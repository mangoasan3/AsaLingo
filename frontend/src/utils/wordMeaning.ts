import type { VocabularyWord } from "@/types";

export function getNativeMeaning(word: Pick<VocabularyWord, "translation" | "definition">): string {
  return word.translation?.trim() || word.definition;
}

