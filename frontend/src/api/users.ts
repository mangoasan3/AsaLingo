import { apiClient } from "./client";
import type { User, UserStats, CefrLevel, ContentStyle } from "@/types";

export const usersApi = {
  getMe: () => apiClient.get<{ data: User }>("/users/me"),

  updateMe: (data: Partial<Pick<User, "name" | "currentLevel" | "studyLanguage" | "nativeLanguage" | "learningGoal" | "interests">>) =>
    apiClient.patch<{ data: User }>("/users/me", data),

  completeOnboarding: (data: {
    studyLanguage: string;
    nativeLanguage: string;
    currentLevel: CefrLevel;
    interests?: string[];
    learningGoal?: string;
    preferredContentStyle?: ContentStyle;
  }) => apiClient.post<{ data: User }>("/users/me/onboarding", data),

  getStats: () => apiClient.get<{ data: UserStats }>("/users/me/stats"),

  deleteAccount: () => apiClient.delete("/users/me"),
};
