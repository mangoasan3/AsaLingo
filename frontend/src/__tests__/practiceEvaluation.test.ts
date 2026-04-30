import { describe, expect, it } from "vitest";
import { evaluateQuizAnswerLocally } from "../lib/practiceEvaluation";
import type { QuizQuestion } from "../types";

const t = (key: string) => key;

describe("evaluateQuizAnswerLocally", () => {
  it("does not auto-pass irrelevant long writing responses", () => {
    const question = {
      type: "sentence_writing",
      question: "Write a sentence using travel",
      wordId: "word-1",
      questionHash: "hash-1",
      targetWord: "travel",
      minWords: 6,
      keywordHints: [],
      instructions: [],
      helpfulTips: [],
    } satisfies QuizQuestion;

    const evaluation = evaluateQuizAnswerLocally(
      question,
      "banana banana banana banana banana banana banana banana",
      t
    );

    expect(evaluation.correct).toBe(false);
    expect(evaluation.status).toBe("pending_review");
    expect(evaluation.feedback).toBe("practice.live.aiReviewUnavailableNoPenalty");
  });

  it("still handles deterministic question types locally", () => {
    const question = {
      type: "multiple_choice",
      question: "Choose the right answer",
      wordId: "word-2",
      questionHash: "hash-2",
      options: ["cat", "dog", "bird"],
      correctAnswer: "dog",
    } satisfies QuizQuestion;

    const evaluation = evaluateQuizAnswerLocally(question, "dog", t);

    expect(evaluation.correct).toBe(true);
    expect(evaluation.status).toBe("correct");
    expect(evaluation.feedback).toBe("practice.live.niceWork");
  });
});
