import { apiClient } from "./client";
import type { VocabularyWord, UserWord, PaginatedWords, WordStatus, CefrLevel } from "@/types";

export const wordsApi = {
  getWords: (params?: { level?: CefrLevel; topic?: string; language?: string; page?: number; limit?: number }) =>
    apiClient.get<{ data: PaginatedWords }>("/words", { params }),

  getWordById: (id: string) =>
    apiClient.get<{ data: VocabularyWord }>(`/words/${id}`),

  searchWords: (q: string) =>
    apiClient.get<{ data: VocabularyWord[] }>("/words/search", { params: { q } }),

  getRecommended: () =>
    apiClient.get<{ data: VocabularyWord[] }>("/words/recommended"),

  getMyWords: (status?: WordStatus) =>
    apiClient.get<{ data: UserWord[] }>("/words/me/list", { params: status ? { status } : undefined }),

  saveWord: (wordId: string) =>
    apiClient.post<{ data: UserWord }>(`/words/me/${wordId}/save`),

  markLearned: (wordId: string) =>
    apiClient.post<{ data: UserWord }>(`/words/me/${wordId}/learned`),

  markDifficult: (wordId: string) =>
    apiClient.post<{ data: UserWord }>(`/words/me/${wordId}/difficult`),

  updateStatus: (wordId: string, status: WordStatus) =>
    apiClient.patch<{ data: UserWord }>(`/words/me/${wordId}/status`, { status }),

  removeWord: (wordId: string) =>
    apiClient.delete(`/words/me/${wordId}`),
};
