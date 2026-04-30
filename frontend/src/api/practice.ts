import { apiClient } from "./client";
import type {
  DailyPractice,
  LessonSubmissionSummary,
  QuizAnswerEvaluation,
  QuizQuestion,
  SubmittedExerciseAnswer,
} from "@/types";

export const practiceApi = {
  getDaily: () =>
    apiClient.get<{ data: DailyPractice }>("/practice/daily"),

  submit: (data: {
    sessionType: string;
    exerciseSessionId?: string;
    results: SubmittedExerciseAnswer[];
    durationSecs?: number;
  }) =>
    apiClient.post<{ data: LessonSubmissionSummary & { totalWords?: number } }>(
      "/practice/submit",
      data
    ),
};

export const aiApi = {
  explainWord: (wordId: string) =>
    apiClient.post<{ data: { simpleExplanation: string; tips: string[] } }>("/ai/explain-word", { wordId }),

  exampleSentences: (wordId: string) =>
    apiClient.post<{ data: { sentences: string[] } }>("/ai/example-sentences", { wordId }),

  generateQuiz: () =>
    apiClient.post<{ data: QuizQuestion[] }>("/ai/generate-quiz"),

  generateDiscoverQuiz: () =>
    apiClient.post<{ data: QuizQuestion[] }>("/ai/generate-discover-quiz"),

  evaluateQuizAnswer: (data: { question: QuizQuestion; answer: string }) =>
    apiClient.post<{ data: QuizAnswerEvaluation }>("/ai/evaluate-quiz-answer", data),

  similarWords: (wordId: string) =>
    apiClient.post<{ data: import("@/types").VocabularyWord[] }>("/ai/similar-words", { wordId }),
};
