import { apiClient } from "./client";
import type {
  CefrLevel,
  ContentStyle,
  PlacementItem,
  PlacementResult,
  PlacementSession,
  User,
} from "@/types";

export const placementApi = {
  start: (data: {
    studyLanguage: string;
    nativeLanguage: string;
    interests?: string[];
    learningGoal?: string;
    preferredContentStyle?: ContentStyle;
  }) => apiClient.post<{ data: PlacementSession }>("/placement/start", data),

  next: (sessionId: string) =>
    apiClient.get<{ data: { complete: boolean; item?: PlacementItem; result?: PlacementResult } }>(
      `/placement/${sessionId}/next`
    ),

  submit: (sessionId: string, data: { itemId: string; answer: string }) =>
    apiClient.post<{
      data: {
        evaluation: { correct: boolean; score: number; feedback: string };
        progress: { answered: number; target: number; shouldFinish: boolean };
      };
    }>(`/placement/${sessionId}/submit`, data),

  finish: (sessionId: string) =>
    apiClient.post<{ data: { result: PlacementResult; user: User } }>(
      `/placement/${sessionId}/finish`
    ),

  manual: (data: {
    studyLanguage: string;
    nativeLanguage: string;
    currentLevel: CefrLevel;
    interests?: string[];
    learningGoal?: string;
    preferredContentStyle?: ContentStyle;
  }) => apiClient.post<{ data: { result: PlacementResult; user: User } }>("/placement/manual", data),
};
