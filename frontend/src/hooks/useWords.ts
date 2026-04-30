import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { wordsApi } from "@/api/words";
import { useT } from "@/i18n";
import toast from "@/lib/toast";
import type { CefrLevel, WordStatus } from "@/types";

export function useRecommendedWords() {
  return useQuery({
    queryKey: ["words", "recommended"],
    queryFn: async () => {
      const res = await wordsApi.getRecommended();
      return res.data.data;
    },
  });
}

export function useWords(params?: { level?: CefrLevel; topic?: string; page?: number }) {
  return useQuery({
    queryKey: ["words", params],
    queryFn: async () => {
      const res = await wordsApi.getWords(params);
      return res.data.data;
    },
  });
}

export function useWord(id: string) {
  return useQuery({
    queryKey: ["word", id],
    queryFn: async () => {
      const res = await wordsApi.getWordById(id);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useMyWords(status?: WordStatus) {
  return useQuery({
    queryKey: ["myWords", status],
    queryFn: async () => {
      const res = await wordsApi.getMyWords(status);
      return res.data.data;
    },
  });
}

export function useSaveWord() {
  const qc = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (wordId: string) => wordsApi.saveWord(wordId),
    onSuccess: () => {
      toast.success(t("toast.wordSaved"));
      qc.invalidateQueries({ queryKey: ["myWords"] });
    },
    onError: () => toast.error(t("toast.error")),
  });
}

export function useMarkLearned() {
  const qc = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (wordId: string) => wordsApi.markLearned(wordId),
    onSuccess: () => {
      toast.success(t("toast.wordLearned"));
      qc.invalidateQueries({ queryKey: ["myWords"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => toast.error(t("toast.error")),
  });
}

export function useMarkDifficult() {
  const qc = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (wordId: string) => wordsApi.markDifficult(wordId),
    onSuccess: () => {
      toast.success(t("toast.wordDifficult"));
      qc.invalidateQueries({ queryKey: ["myWords"] });
    },
  });
}

export function useRemoveWord() {
  const qc = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (wordId: string) => wordsApi.removeWord(wordId),
    onSuccess: () => {
      toast.success(t("toast.wordRemoved"));
      qc.invalidateQueries({ queryKey: ["myWords"] });
    },
  });
}
