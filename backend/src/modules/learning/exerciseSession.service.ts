import { AppError } from "../../middleware/errorHandler";
import { ExerciseSession, User, type IExerciseSession, type IUser } from "../../models";
import { evaluateQuizAnswer, toPublicQuizQuestion } from "../ai/ai.service";
import type {
  PublicQuizQuestion,
  QuizAnswerEvaluation,
  QuizEvaluationStatus,
  QuizQuestion,
} from "../ai/quiz.types";

const EXERCISE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface StoredLessonPayload {
  node?: Record<string, unknown>;
  focusWords: Record<string, unknown>[];
  exercises: Array<Record<string, unknown>>;
  phase?: string;
  scriptSupport?: Record<string, unknown>;
}

export interface SubmittedExerciseAnswer {
  wordId?: string;
  questionHash?: string;
  questionType?: string;
  answer?: string;
  templateFamily?: string;
  correct?: boolean;
}

export interface VerifiedPracticeResult {
  wordId: string;
  correct: boolean;
  evaluationStatus: QuizEvaluationStatus;
  countedInScore: boolean;
  questionHash?: string;
  questionType?: string;
  answer?: string;
  templateFamily?: string;
}

export interface VerifiedSubmissionSummary {
  results: VerifiedPracticeResult[];
  total: number;
  correctCount: number;
  evaluatedCount: number;
  pendingReviewCount: number;
  score: number;
  progressRatio: number;
  exerciseTypes: string[];
  templateFamilies: string[];
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getEvaluationStatus(evaluation: QuizAnswerEvaluation): QuizEvaluationStatus {
  return evaluation.status ?? (evaluation.correct ? "correct" : "incorrect");
}

function isStoredQuestion(value: unknown): value is Record<string, unknown> & {
  wordId: string;
  type: string;
  questionHash: string;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(cleanText(record.wordId) && cleanText(record.type) && cleanText(record.questionHash));
}

function getQuestionTemplateFamily(question: Record<string, unknown>) {
  const exerciseMeta = question.exerciseMeta;
  if (!exerciseMeta || typeof exerciseMeta !== "object") return undefined;
  return cleanText((exerciseMeta as Record<string, unknown>).templateFamily) || undefined;
}

function buildPublicPayload(session: IExerciseSession) {
  return {
    exerciseSessionId: String(session._id),
    node: session.nodeSnapshot,
    focusWords: session.focusWordsSnapshot,
    phase: session.phase,
    scriptSupport: session.scriptSupport,
    exercises: session.exercises
      .filter(isStoredQuestion)
      .map((question) => toPublicQuizQuestion(question as unknown as QuizQuestion)) as PublicQuizQuestion[],
  };
}

export async function createExerciseSession(params: {
  userId: string;
  source: IExerciseSession["source"];
  cacheKey: string;
  roadmapNodeId?: string;
  mode?: IExerciseSession["mode"];
  payload: StoredLessonPayload;
}) {
  const session = await ExerciseSession.create({
    userId: params.userId,
    source: params.source,
    cacheKey: params.cacheKey,
    roadmapNodeId: params.roadmapNodeId,
    mode: params.mode,
    nodeSnapshot: params.payload.node,
    focusWordsSnapshot: params.payload.focusWords,
    exercises: params.payload.exercises,
    phase: params.payload.phase,
    scriptSupport: params.payload.scriptSupport,
    expiresAt: new Date(Date.now() + EXERCISE_SESSION_TTL_MS),
  });

  return buildPublicPayload(session);
}

export async function getCachedExerciseSession(userId: string, cacheKey: string) {
  const session = await ExerciseSession.findOne({
    userId,
    cacheKey,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });

  return session ? buildPublicPayload(session as unknown as IExerciseSession) : null;
}

async function getSubmissionUser(userOrId: IUser | string) {
  if (typeof userOrId !== "string") return userOrId;
  const user = await User.findById(userOrId);
  if (!user) throw new AppError("User not found", 404);
  return user;
}

async function getSessionQuestionMap(userId: string, exerciseSessionId?: string) {
  if (!exerciseSessionId) return null;
  const session = await ExerciseSession.findOne({
    _id: exerciseSessionId,
    userId,
    expiresAt: { $gt: new Date() },
  }).lean({ virtuals: true });

  if (!session) {
    throw new AppError("This exercise session expired. Please generate a new lesson.", 409);
  }

  const questions = (session.exercises ?? []).filter(isStoredQuestion);
  return new Map(questions.map((question) => [cleanText(question.questionHash), question]));
}

function buildLegacyQuestion(result: SubmittedExerciseAnswer) {
  const questionType = cleanText(result.questionType);
  const wordId = cleanText(result.wordId);

  if (!questionType || !wordId) {
    throw new AppError("Each submitted answer must include a verifiable question reference.", 400);
  }

  return {
    type: questionType,
    wordId,
    questionHash: cleanText(result.questionHash) || `legacy:${questionType}:${wordId}`,
  } as Record<string, unknown> & { type: string; wordId: string; questionHash: string };
}

export async function verifySubmittedResults(params: {
  user: IUser | string;
  submittedResults: SubmittedExerciseAnswer[];
  exerciseSessionId?: string;
}): Promise<VerifiedSubmissionSummary> {
  const user = await getSubmissionUser(params.user);
  const questionMap = await getSessionQuestionMap(String(user._id), params.exerciseSessionId);
  const results: VerifiedPracticeResult[] = [];

  for (const submitted of params.submittedResults) {
    const answer = cleanText(submitted.answer);
    if (!answer) {
      throw new AppError("Answer is required for each submitted result.", 400);
    }

    const submittedHash = cleanText(submitted.questionHash);
    const question =
      questionMap?.get(submittedHash) ??
      (!questionMap ? buildLegacyQuestion(submitted) : null);

    if (!question) {
      throw new AppError("One or more submitted answers do not match the active exercise session.", 409);
    }

    const evaluatableQuestion = question as Record<string, unknown> & {
      type: QuizQuestion["type"];
      wordId: string;
      questionHash: string;
    };
    const evaluation = await evaluateQuizAnswer({
      level: user.currentLevel,
      studyLanguage: user.studyLanguage || "en",
      nativeLanguage: user.nativeLanguage || "ru",
      question: evaluatableQuestion,
      answer,
    });
    const evaluationStatus = getEvaluationStatus(evaluation);
    const submittedTemplateFamily = cleanText(submitted.templateFamily) || undefined;

    results.push({
      wordId: cleanText(evaluatableQuestion.wordId),
      correct: evaluationStatus === "correct",
      evaluationStatus,
      countedInScore: evaluationStatus !== "pending_review",
      questionHash: cleanText(evaluatableQuestion.questionHash) || undefined,
      questionType: cleanText(evaluatableQuestion.type) || cleanText(submitted.questionType) || undefined,
      answer,
      templateFamily: getQuestionTemplateFamily(evaluatableQuestion) ?? submittedTemplateFamily,
    });
  }

  const correctCount = results.filter((result) => result.evaluationStatus === "correct").length;
  const pendingReviewCount = results.filter(
    (result) => result.evaluationStatus === "pending_review"
  ).length;
  const evaluatedCount = results.filter((result) => result.countedInScore).length;
  const total = results.length;
  const score = evaluatedCount > 0 ? correctCount / evaluatedCount : 0;
  const progressRatio = total > 0 ? (correctCount + pendingReviewCount) / total : 0;

  return {
    results,
    total,
    correctCount,
    evaluatedCount,
    pendingReviewCount,
    score,
    progressRatio,
    exerciseTypes: [...new Set(results.map((result) => result.questionType).filter(Boolean) as string[])],
    templateFamilies: [
      ...new Set(results.map((result) => result.templateFamily).filter(Boolean) as string[]),
    ],
  };
}
