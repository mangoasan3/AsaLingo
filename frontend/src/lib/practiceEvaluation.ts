import type { TFunction } from "@/i18n";
import type { QuizAnswerEvaluation, QuizQuestion } from "@/types";

export function normalizePracticeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCorrectAnswer(question: QuizQuestion) {
  return "correctAnswer" in question ? question.correctAnswer : undefined;
}

function getAcceptedAnswers(question: QuizQuestion) {
  if ("acceptedAnswers" in question && question.acceptedAnswers?.length) return question.acceptedAnswers;
  const correct = getCorrectAnswer(question);
  return correct ? [correct] : [];
}

function parseMatchingPairs(value: string): Array<{ left: string; right: string }> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const pair = item as Record<string, unknown>;
        const left = String(pair.left ?? "").trim();
        const right = String(pair.right ?? "").trim();
        return left && right ? { left, right } : null;
      })
      .filter((item): item is { left: string; right: string } => Boolean(item));
  } catch {
    return [];
  }
}

const WRITING_FALLBACK_TYPES = new Set<QuizQuestion["type"]>([
  "sentence_writing",
  "short_paragraph_response",
  "summary",
  "argument_response",
  "essay_writing",
]);

const EXACT_FALLBACK_TYPES = new Set<QuizQuestion["type"]>([
  "translation_input",
  "error_correction",
  "open_translation",
  "translation_variants",
]);

export function shouldUseAiEvaluation(question: QuizQuestion) {
  const evaluationMode = question.exerciseMeta?.evaluationMode;
  return (
    evaluationMode === "ai" ||
    evaluationMode === "rubric" ||
    question.type === "translation_input" ||
    question.type === "sentence_writing" ||
    question.type === "error_correction" ||
    question.type === "open_translation" ||
    question.type === "translation_variants" ||
    question.type === "short_paragraph_response" ||
    question.type === "summary" ||
    question.type === "argument_response" ||
    question.type === "essay_writing"
  );
}

export function evaluateQuizAnswerLocally(
  question: QuizQuestion,
  answer: string,
  t: TFunction
): QuizAnswerEvaluation {
  const normalizedAnswer = normalizePracticeText(answer);
  const accepted = getAcceptedAnswers(question).map(normalizePracticeText);
  const correctAnswer = getCorrectAnswer(question);

  if (question.type === "matching") {
    const expected = new Map(
      question.pairs.map((pair) => [normalizePracticeText(pair.left), normalizePracticeText(pair.right)])
    );
    const answered = parseMatchingPairs(answer);
    const correct =
      expected.size > 0 &&
      answered.length === expected.size &&
      answered.every(
        (pair) =>
          expected.get(normalizePracticeText(pair.left)) === normalizePracticeText(pair.right)
      );

    return {
      questionType: question.type,
      status: correct ? "correct" : "incorrect",
      correct,
      feedback: correct ? t("practice.live.matchingCompleted") : t("practice.live.answerMismatch"),
      correctAnswer,
      hasMistakes: !correct,
    };
  }

  if (question.type === "reorder_words") {
    const correct = accepted.some((item) => item === normalizedAnswer);
    return {
      questionType: question.type,
      status: correct ? "correct" : "incorrect",
      correct,
      feedback: correct ? t("practice.live.niceSentence") : t("practice.live.sentenceNeedsReview"),
      correctAnswer,
      hasMistakes: !correct,
    };
  }

  if (WRITING_FALLBACK_TYPES.has(question.type)) {
    return {
      questionType: question.type,
      status: "pending_review",
      correct: false,
      feedback: t("practice.live.aiReviewUnavailableNoPenalty"),
      correctAnswer,
      hasMistakes: false,
      ruleChecks:
        "rubric" in question && Array.isArray(question.rubric)
          ? question.rubric.map((rule) => ({
              label: rule,
              passed: false,
              detail: t("practice.live.aiReviewUnavailableRule"),
            }))
          : undefined,
    };
  }

  if (EXACT_FALLBACK_TYPES.has(question.type)) {
    const correct = accepted.length > 0 && accepted.some((item) => item === normalizedAnswer);
    return {
      questionType: question.type,
      status: correct ? "correct" : "pending_review",
      correct,
      feedback: correct
        ? t("practice.live.strictFallbackAccepted")
        : t("practice.live.aiReviewUnavailableNoPenalty"),
      correctAnswer,
      hasMistakes: false,
    };
  }

  const correct = accepted.length > 0 && accepted.some((item) => item === normalizedAnswer);
  return {
    questionType: question.type,
    status: correct ? "correct" : "incorrect",
    correct,
    feedback: correct ? t("practice.live.niceWork") : t("practice.live.answerMismatch"),
    correctAnswer,
    hasMistakes: !correct,
  };
}
