import { apiClient } from "./client";
import type {
  LearningDashboard,
  LessonSubmissionSummary,
  LessonPayload,
  MediaTask,
  RoadmapPayload,
  SubmittedExerciseAnswer,
} from "@/types";

export const learningApi = {
  dashboard: () =>
    apiClient.get<{ data: LearningDashboard }>("/learning/dashboard"),

  roadmap: () =>
    apiClient.get<{ data: RoadmapPayload }>("/learning/roadmap"),

  continueLesson: () =>
    apiClient.get<{ data: LessonPayload }>("/learning/continue"),

  practice: (mode: "lesson" | "review" | "challenge" = "lesson") =>
    apiClient.get<{ data: LessonPayload }>(
      "/learning/practice",
      { params: { mode } }
    ),

  mediaTasks: () =>
    apiClient.get<{ data: MediaTask[] }>("/learning/media-tasks"),

  submit: (data: {
    sessionType?: "GUIDED_LESSON" | "ROADMAP_REVIEW" | "MIXED" | "MEDIA";
    exerciseSessionId: string;
    roadmapNodeId?: string;
    results: SubmittedExerciseAnswer[];
    durationSecs?: number;
  }) =>
    apiClient.post<{
      data: LessonSubmissionSummary;
    }>("/learning/submit", data),

  startNode: (nodeId: string) =>
    apiClient.post<{ data: LearningDashboard }>(`/learning/roadmap/${nodeId}/start`),
};
