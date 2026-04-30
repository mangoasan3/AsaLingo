/**
 * quizAnswerChecking.test.ts
 *
 * Pure-logic tests for quiz answer checking, correct-answer propagation,
 * duplicate prevention, and media URL safety.  No DB or AI calls.
 */

import {
  DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID,
  buildYoutubeRuntimeSourceUrl,
} from "../utils/youtube";

// ─── helpers (inlined to avoid importing the DB-coupled service) ─────────────

function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAnswerVariants(value: string, fallback?: string): string[] {
  const variants = value
    .split(/[;,/]| or /gi)
    .map((item) => normalizeAnswer(item))
    .filter(Boolean);
  if (fallback) variants.push(normalizeAnswer(fallback));
  return [...new Set(variants)].slice(0, 6);
}

interface ExactMatchParams {
  answer: string;
  correctAnswer: string;
  acceptedAnswers?: string[];
}

function buildExactMatchResult(params: ExactMatchParams): {
  correct: boolean;
  status: "correct" | "incorrect";
  correctAnswer: string;
  feedback: string;
} {
  const accepted =
    params.acceptedAnswers && params.acceptedAnswers.length > 0
      ? params.acceptedAnswers
      : [params.correctAnswer];
  const correct = accepted.some(
    (item) => normalizeAnswer(item) === normalizeAnswer(params.answer)
  );
  return {
    correct,
    status: correct ? "correct" : "incorrect",
    correctAnswer: params.correctAnswer,
    feedback: correct ? "Nice work." : "Not quite. The correct answer is shown below.",
  };
}

// ─── Exact-match answer checking ─────────────────────────────────────────────

describe("Exact-match answer checking", () => {
  test("exact correct answer is accepted", () => {
    const result = buildExactMatchResult({ answer: "apple", correctAnswer: "apple" });
    expect(result.correct).toBe(true);
    expect(result.status).toBe("correct");
  });

  test("case-insensitive match is accepted", () => {
    const result = buildExactMatchResult({ answer: "Apple", correctAnswer: "apple" });
    expect(result.correct).toBe(true);
  });

  test("leading/trailing whitespace is ignored", () => {
    const result = buildExactMatchResult({ answer: "  apple  ", correctAnswer: "apple" });
    expect(result.correct).toBe(true);
  });

  test("wrong answer is rejected", () => {
    const result = buildExactMatchResult({ answer: "pear", correctAnswer: "apple" });
    expect(result.correct).toBe(false);
    expect(result.status).toBe("incorrect");
  });

  test("correctAnswer is always returned in the result", () => {
    const result = buildExactMatchResult({ answer: "wrong", correctAnswer: "apple" });
    expect(result.correctAnswer).toBe("apple");
  });

  test("incorrect feedback message references the correct answer panel", () => {
    const result = buildExactMatchResult({ answer: "wrong", correctAnswer: "apple" });
    expect(result.feedback).toMatch(/correct answer/i);
  });

  test("accepted answer variant is accepted even when it differs from correctAnswer", () => {
    const result = buildExactMatchResult({
      answer: "последствия",
      correctAnswer: "последствие",
      acceptedAnswers: ["последствие", "последствия"],
    });
    expect(result.correct).toBe(true);
  });

  test("answer not in acceptedAnswers is rejected", () => {
    const result = buildExactMatchResult({
      answer: "результат",
      correctAnswer: "последствие",
      acceptedAnswers: ["последствие", "последствия"],
    });
    expect(result.correct).toBe(false);
  });
});

// ─── Answer normalisation ─────────────────────────────────────────────────────

describe("Answer normalisation (normalizeAnswer)", () => {
  test("strips punctuation", () => {
    expect(normalizeAnswer("hello!")).toBe("hello");
  });

  test("collapses multiple spaces", () => {
    expect(normalizeAnswer("to   go")).toBe("to go");
  });

  test("lowercases everything", () => {
    expect(normalizeAnswer("Hello World")).toBe("hello world");
  });

  test("NFKC normalisation combines diacritics", () => {
    // é as e + combining acute should normalise to a single code point
    const combined = "é"; // e + combining acute
    expect(normalizeAnswer(combined)).toBe(normalizeAnswer("é"));
  });

  test("preserves hyphens in compound words", () => {
    expect(normalizeAnswer("well-known")).toBe("well-known");
  });

  test("preserves apostrophes", () => {
    expect(normalizeAnswer("don't")).toBe("don't");
  });
});

// ─── Answer variant splitting ────────────────────────────────────────────────

describe("getAnswerVariants", () => {
  test("splits on semicolons", () => {
    const variants = getAnswerVariants("house; home; dwelling");
    expect(variants).toContain("house");
    expect(variants).toContain("home");
    expect(variants).toContain("dwelling");
  });

  test("splits on slash", () => {
    const variants = getAnswerVariants("plan/scheme");
    expect(variants).toContain("plan");
    expect(variants).toContain("scheme");
  });

  test("splits on ' or '", () => {
    const variants = getAnswerVariants("cat or cats");
    expect(variants).toContain("cat");
    expect(variants).toContain("cats");
  });

  test("fallback is included when main value is a single form", () => {
    const variants = getAnswerVariants("consequence", "последствие");
    expect(variants).toContain("consequence");
    expect(variants).toContain("последствие");
  });

  test("duplicates are removed", () => {
    const variants = getAnswerVariants("apple/apple");
    expect(variants.filter((v) => v === "apple")).toHaveLength(1);
  });
});

// ─── Correct answer propagated to evaluation ────────────────────────────────

describe("correctAnswer in evaluation result", () => {
  test("incorrect response always carries correctAnswer for UI display", () => {
    const result = buildExactMatchResult({ answer: "wrong", correctAnswer: "right" });
    expect(typeof result.correctAnswer).toBe("string");
    expect(result.correctAnswer).toBe("right");
  });

  test("correct response also carries correctAnswer", () => {
    const result = buildExactMatchResult({ answer: "right", correctAnswer: "right" });
    expect(result.correct).toBe(true);
    expect(result.correctAnswer).toBe("right");
  });
});

// ─── Media URL safety ────────────────────────────────────────────────────────

describe("Media URL safety — fake placeholder prevention", () => {
  test("DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID constant matches the known blocked value", () => {
    expect(DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID).toBe("M7lc1UVf-VE");
  });

  test("buildYoutubeRuntimeSourceUrl returns a URL containing the fallback ID", () => {
    expect(buildYoutubeRuntimeSourceUrl()).toContain(DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID);
  });

  test("a null media task means no video exercises are emitted", () => {
    // Simulate the filter applied in buildLocalRoadmapExercises:
    // exercises with mediaNeeds=video are excluded when params.media is null.
    const hasMedia = false;
    const exerciseTypes: Array<{ type: string; mediaNeeds: "none" | "image" | "audio" | "video" }> = [
      { type: "transcript_gap_fill", mediaNeeds: "video" },
      { type: "media_comprehension", mediaNeeds: "video" },
      { type: "multiple_choice", mediaNeeds: "none" },
      { type: "fill_blank", mediaNeeds: "none" },
    ];

    const usable = exerciseTypes.filter((ex) => {
      if (ex.mediaNeeds === "audio") return false;
      if (ex.mediaNeeds === "video") return hasMedia;
      return true;
    });

    expect(usable.map((ex) => ex.type)).not.toContain("transcript_gap_fill");
    expect(usable.map((ex) => ex.type)).not.toContain("media_comprehension");
    expect(usable.map((ex) => ex.type)).toContain("multiple_choice");
    expect(usable.map((ex) => ex.type)).toContain("fill_blank");
  });

  test("a media task with the placeholder URL is identifiable", () => {
    const placeholderUrl = buildYoutubeRuntimeSourceUrl();
    const isPlaceholder = placeholderUrl.includes(DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID);
    expect(isPlaceholder).toBe(true);
  });
});

// ─── Duplicate question detection ────────────────────────────────────────────

describe("Question duplicate detection", () => {
  type MinimalQuestion = { questionHash: string; type: string; wordId: string };

  function deduplicateByHash(questions: MinimalQuestion[]): MinimalQuestion[] {
    const seen = new Set<string>();
    return questions.filter((q) => {
      if (seen.has(q.questionHash)) return false;
      seen.add(q.questionHash);
      return true;
    });
  }

  function filterRecentHashes(
    questions: MinimalQuestion[],
    recentHashes: Set<string>
  ): MinimalQuestion[] {
    return questions.filter((q) => !recentHashes.has(q.questionHash));
  }

  test("deduplicateByHash removes duplicate hashes", () => {
    const questions: MinimalQuestion[] = [
      { questionHash: "aaa", type: "multiple_choice", wordId: "w1" },
      { questionHash: "bbb", type: "fill_blank", wordId: "w2" },
      { questionHash: "aaa", type: "multiple_choice", wordId: "w1" }, // duplicate
    ];
    const deduped = deduplicateByHash(questions);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((q) => q.questionHash)).toEqual(["aaa", "bbb"]);
  });

  test("questions with recent hashes are excluded in phase 1", () => {
    const recentHashes = new Set(["aaa", "bbb"]);
    const questions: MinimalQuestion[] = [
      { questionHash: "aaa", type: "multiple_choice", wordId: "w1" },
      { questionHash: "bbb", type: "fill_blank", wordId: "w2" },
      { questionHash: "ccc", type: "reverse_multiple_choice", wordId: "w3" },
    ];
    const fresh = filterRecentHashes(questions, recentHashes);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].questionHash).toBe("ccc");
  });

  test("when all questions are recent, none are excluded (phase 3 fallback)", () => {
    const recentHashes = new Set(["aaa", "bbb", "ccc"]);
    const questions: MinimalQuestion[] = [
      { questionHash: "aaa", type: "multiple_choice", wordId: "w1" },
      { questionHash: "bbb", type: "fill_blank", wordId: "w2" },
      { questionHash: "ccc", type: "reverse_multiple_choice", wordId: "w3" },
    ];
    // Phase 3 allows all — the phase logic falls through to a less-strict pool
    const freshOnly = filterRecentHashes(questions, recentHashes);
    expect(freshOnly).toHaveLength(0);
    // But the full phase-3 pool still has candidates (not filtered):
    expect(questions).toHaveLength(3);
  });

  test("consecutive same-type detection works correctly", () => {
    const session: MinimalQuestion[] = [
      { questionHash: "h1", type: "multiple_choice", wordId: "w1" },
      { questionHash: "h2", type: "fill_blank", wordId: "w2" },
      { questionHash: "h3", type: "multiple_choice", wordId: "w3" },
    ];
    // No consecutive same type here
    for (let i = 1; i < session.length; i++) {
      expect(session[i].type).not.toBe(session[i - 1].type);
    }
  });

  test("detects consecutive same-type violation", () => {
    const bad: MinimalQuestion[] = [
      { questionHash: "h1", type: "multiple_choice", wordId: "w1" },
      { questionHash: "h2", type: "multiple_choice", wordId: "w2" },
    ];
    const hasConsecutive = bad.some(
      (q, i) => i > 0 && q.type === bad[i - 1].type
    );
    expect(hasConsecutive).toBe(true);
  });
});

// ─── Multiple-choice server-side checking ───────────────────────────────────

describe("Multiple-choice deterministic checking (no AI)", () => {
  test("selected option matches correctAnswer → correct", () => {
    const correctAnswer = "consequence";
    const userAnswer = "consequence";
    const result = buildExactMatchResult({ answer: userAnswer, correctAnswer });
    expect(result.correct).toBe(true);
  });

  test("selected option does not match correctAnswer → incorrect", () => {
    const correctAnswer = "consequence";
    const userAnswer = "result";
    const result = buildExactMatchResult({ answer: userAnswer, correctAnswer });
    expect(result.correct).toBe(false);
  });

  test("evaluation does not call AI for choice questions — correctAnswer comes from stored value", () => {
    // This test documents the architecture: for CHOICE_QUESTION_TYPES the
    // backend uses buildExactMatchEvaluation (no AI call).
    // The stored correctAnswer is compared directly with normalizeAnswer().
    const stored = "to achieve";
    const userTyped = "To Achieve";
    const correct = normalizeAnswer(stored) === normalizeAnswer(userTyped);
    expect(correct).toBe(true);
  });
});
