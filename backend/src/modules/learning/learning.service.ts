import crypto from "crypto";
import {
  CurriculumNode,
  LearningSession,
  MediaTask,
  User,
  UserRoadmapProgress,
  UserWord,
  VocabularyWord,
} from "../../models";
import type {
  CefrLevel,
  ICurriculumNode,
  IMediaTask,
  IUser,
  IVocabularyWord,
  PracticeType,
} from "../../models";
import { AppError } from "../../middleware/errorHandler";
import { getCuratedMediaTasksForLanguage } from "../../constants/curatedMediaTasks";
import { normalizeLanguageCode, normalizeTopic } from "../../utils/language";
import { ensureWordsForNode, seedLearningFoundation } from "../../seeds/learningSeed";
import { generateAndSaveWords, generateRoadmapExercises } from "../ai/ai.service";
import { buildLearningContext } from "./learningContext.service";
import {
  createExerciseSession,
  getCachedExerciseSession,
  type StoredLessonPayload,
  type SubmittedExerciseAnswer,
  type VerifiedPracticeResult,
  verifySubmittedResults,
} from "./exerciseSession.service";
import {
  getExerciseMetadata,
  getRecommendedExerciseTypes,
  type ExerciseType,
} from "./exerciseCatalog";

interface LessonSubmitPayload {
  sessionType?: PracticeType;
  exerciseSessionId?: string;
  roadmapNodeId?: string;
  results: SubmittedExerciseAnswer[];
  durationSecs?: number;
}

interface RoadmapProgressLean {
  nodeId: string;
  status: string;
  progressPercent: number;
  attempts: number;
  bestScore?: number;
  lastScore?: number;
}

interface RoadmapNodeWithProgress extends ICurriculumNode {
  progress: RoadmapProgressLean;
}

interface RoadmapResponse {
  currentRoadmapNodeId?: string;
  nodes: RoadmapNodeWithProgress[];
}

const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];
const LESSON_WORD_SOURCE_FILTER = { sourceType: { $in: ["ai-generated", "seed"] } };
const MIN_LESSON_WORDS = 12;
const TARGET_LESSON_WORDS = 24;
const YOUTUBE_SOURCE_URL_PATTERN = /(?:youtube\.com|youtu\.be)/i;

function cleanText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeWord<T extends Record<string, unknown>>(word: T): T & { id: string } {
  return {
    ...word,
    id: String(word.id ?? word._id ?? ""),
  };
}

function asVocabularyWord(word: Record<string, unknown>): IVocabularyWord {
  return normalizeWord(word) as unknown as IVocabularyWord;
}

async function getRecentQuestionHashes(userId: string, targetLanguage: string, nativeLanguage: string) {
  const sessions = await LearningSession.find({ userId, targetLanguage, nativeLanguage })
    .sort({ createdAt: -1 })
    .limit(18)
    .select("wordsAsked questionHashes templateFamilies")
    .lean();

  return {
    hashes: new Set(sessions.flatMap((session) => session.questionHashes ?? [])),
    wordIds: new Set(sessions.flatMap((session) => session.wordsAsked ?? [])),
    templateFamilies: new Set(sessions.flatMap((session) => session.templateFamilies ?? [])),
  };
}

async function introduceWordsForNode(userId: string, node: ICurriculumNode, words: IVocabularyWord[]) {
  const introducedWordIds: string[] = [];

  for (const [index, word] of words.entries()) {
    introducedWordIds.push(word.id);
    await UserWord.findOneAndUpdate(
      { userId, wordId: word.id },
      {
        $setOnInsert: {
          userId,
          wordId: word.id,
          introducedAt: new Date(),
          introducedBy: "roadmap",
          firstSeenRoadmapNodeId: String(node._id),
          status: index < 3 ? "NEW" : "LEARNING",
          masteryState: "introduced",
          progressionStep: 1,
        },
        $set: {
          lastSeenRoadmapNodeId: String(node._id),
          lessonStep: index < 3 ? "introduction" : "recognition",
        },
        $addToSet: {
          roadmapNodeIds: String(node._id),
        },
        $inc: {
          exposureCount: 1,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return introducedWordIds;
}

async function getUserOrThrow(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  return user;
}

async function getRoadmapNodes(language: string) {
  await seedLearningFoundation(language);
  return CurriculumNode.find({ language, isActive: true })
    .sort({ stageOrder: 1, unit: 1, lesson: 1 })
    .lean({ virtuals: true }) as Promise<unknown> as Promise<ICurriculumNode[]>;
}

async function ensureRoadmapProgress(
  userId: string,
  nodes: ICurriculumNode[],
  currentNodeId?: string
): Promise<RoadmapProgressLean[]> {
  const existing = await UserRoadmapProgress.find({ userId }).lean({ virtuals: true });
  const existingByNodeId = new Map(existing.map((item) => [String(item.nodeId), item]));
  const completedNodeIds = new Set(
    existing
      .filter((item) => item.status === "completed")
      .map((item) => String(item.nodeId))
  );
  const nodeIdsByKey = new Map(nodes.map((node) => [node.nodeKey, String(node._id)]));

  for (const [index, node] of nodes.entries()) {
    const nodeId = String(node._id);
    const required = node.unlockCriteria?.previousNodeIds ?? [];
    const unlockedByPrevious =
      required.length === 0 ||
      required.every((requiredIdOrKey) => {
        const resolved = nodeIdsByKey.get(requiredIdOrKey) ?? requiredIdOrKey;
        return completedNodeIds.has(resolved);
      });
    const defaultStatus =
      nodeId === currentNodeId
        ? "in_progress"
        : index === 0 || unlockedByPrevious
          ? "available"
          : "locked";

    if (!existingByNodeId.has(nodeId)) {
      await UserRoadmapProgress.create({
        userId,
        nodeId,
        status: defaultStatus,
        progressPercent: defaultStatus === "locked" ? 0 : 0,
        unlockedAt: defaultStatus === "locked" ? undefined : new Date(),
        startedAt: defaultStatus === "in_progress" ? new Date() : undefined,
      });
    } else if (unlockedByPrevious && existingByNodeId.get(nodeId)?.status === "locked") {
      await UserRoadmapProgress.findOneAndUpdate(
        { userId, nodeId },
        { $set: { status: "available", unlockedAt: new Date() } }
      );
    }
  }

  return (await UserRoadmapProgress.find({ userId }).lean({
    virtuals: true,
  })) as unknown as RoadmapProgressLean[];
}

export async function getRoadmap(userId: string): Promise<RoadmapResponse> {
  const user = await getUserOrThrow(userId);
  const language = normalizeLanguageCode(user.studyLanguage, "en");
  const nodes = await getRoadmapNodes(language);
  const progressRecords = await ensureRoadmapProgress(userId, nodes, user.currentRoadmapNodeId);
  const progressByNodeId = new Map(progressRecords.map((item) => [String(item.nodeId), item]));

  return {
    currentRoadmapNodeId: user.currentRoadmapNodeId,
    nodes: nodes.map((node) => ({
      ...node,
      progress: progressByNodeId.get(String(node._id)) ?? {
        nodeId: String(node._id),
        status: "locked",
        progressPercent: 0,
        attempts: 0,
      },
    })) as RoadmapNodeWithProgress[],
  };
}

export async function getDashboard(userId: string): Promise<unknown> {
  const context = await buildLearningContext(userId);
  const roadmap = await getRoadmap(userId);
  const [reviewDueCount, introducedCount, masteredCount] = await Promise.all([
    UserWord.countDocuments({
      userId,
      $or: [
        { status: "DIFFICULT" },
        { nextReviewAt: { $lte: new Date() } },
        { masteryState: { $in: ["practicing", "reviewing"] } },
      ],
    }),
    UserWord.countDocuments({ userId, masteryState: { $in: ["introduced", "practicing", "reviewing", "mastered"] } }),
    UserWord.countDocuments({ userId, masteryState: "mastered" }),
  ]);

  const currentIndex = roadmap.nodes.findIndex(
    (node) => String(node._id) === context.currentRoadmapNode?._id
  );
  const visibleNodes = roadmap.nodes.slice(Math.max(0, currentIndex - 1), currentIndex + 4);

  return {
    learner: {
      level: context.level,
      learnerStage: context.learnerStage,
      scriptStage: context.scriptStage,
      placementSource: context.placementSource,
      placementConfidence: context.placementConfidence,
      interests: context.interests,
      learningGoal: context.learningGoal,
      skillWeaknesses: context.skillWeaknesses,
    },
    continueLearning: context.currentRoadmapNode,
    currentProgress: context.currentProgress,
    dailyPath: visibleNodes,
    reviewDueCount,
    introducedCount,
    masteredCount,
    roadmapProgressPercent:
      roadmap.nodes.length > 0
        ? Math.round(
            (roadmap.nodes.filter((node) => node.progress?.status === "completed").length /
              roadmap.nodes.length) *
              100
          )
        : 0,
    promptContextPreview: context.promptContext,
  };
}

async function getCurrentNode(user: IUser) {
  const language = normalizeLanguageCode(user.studyLanguage, "en");
  await seedLearningFoundation(language);

  let node = user.currentRoadmapNodeId
    ? await CurriculumNode.findById(user.currentRoadmapNodeId).lean({ virtuals: true })
    : null;

  if (!node) {
    node =
      (await CurriculumNode.findOne({
        language,
        level: user.currentLevel,
        learnerStage: user.learnerStage,
        isActive: true,
      })
        .sort({ stageOrder: 1 })
        .lean({ virtuals: true })) ??
      (await CurriculumNode.findOne({ language, isActive: true })
        .sort({ stageOrder: 1 })
        .lean({ virtuals: true }));
  }

  if (!node) throw new AppError("No curriculum node found for this learner", 404);

  if (user.currentRoadmapNodeId !== String(node._id)) {
    user.currentRoadmapNodeId = String(node._id);
    await user.save();
  }

  await UserRoadmapProgress.findOneAndUpdate(
    { userId: user._id, nodeId: String(node._id) },
    {
      $setOnInsert: {
        userId: user._id,
        nodeId: String(node._id),
        unlockedAt: new Date(),
      },
      $set: {
        status: "in_progress",
        startedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return node as unknown as ICurriculumNode;
}

function getLessonTopicPlan(user: IUser, node: ICurriculumNode) {
  const nodeTopics = node.interestTags.length ? node.interestTags : ["daily life", "communication"];
  const userTopics = user.interests?.length ? user.interests : [];
  const rotatedNodeTopics = nodeTopics
    .slice((Math.max(0, node.lesson - 1)) % nodeTopics.length)
    .concat(nodeTopics.slice(0, (Math.max(0, node.lesson - 1)) % nodeTopics.length));

  return [
    ...new Set(
      [...rotatedNodeTopics, ...userTopics, "daily life", "communication"]
        .map((topic) => normalizeTopic(topic))
        .filter(Boolean)
    ),
  ].slice(0, 5);
}

async function fetchLessonWords(params: {
  language: string;
  nativeLanguage: string;
  node: ICurriculumNode;
  limit?: number;
}) {
  return VocabularyWord.find({
    ...LESSON_WORD_SOURCE_FILTER,
    language: params.language,
    nativeLanguage: params.nativeLanguage,
    cefrLevel: params.node.level,
    roadmapNodeIds: String(params.node._id),
  })
    .sort({ progressionStep: 1, createdAt: 1 })
    .limit(params.limit ?? TARGET_LESSON_WORDS)
    .lean({ virtuals: true }) as unknown as Promise<IVocabularyWord[]>;
}

async function getLessonWords(user: IUser, node: ICurriculumNode) {
  const language = normalizeLanguageCode(user.studyLanguage, "en");
  const nativeLanguage = normalizeLanguageCode(user.nativeLanguage, "ru");

  let words = await fetchLessonWords({ language, nativeLanguage, node });

  if (words.length < MIN_LESSON_WORDS) {
    await ensureWordsForNode({ language, nativeLanguage, node });
    words = await fetchLessonWords({ language, nativeLanguage, node });
  }

  if (words.length < TARGET_LESSON_WORDS) {
    const topicPlan = getLessonTopicPlan(user, node);
    let generatedAny = false;

    for (const [index, topic] of topicPlan.entries()) {
      const remaining = TARGET_LESSON_WORDS - words.length;
      if (remaining <= 0) break;

      try {
        const generated = await generateAndSaveWords({
          level: node.level,
          targetLanguage: language,
          nativeLanguage,
          topic,
          count: Math.max(6, Math.min(10, Math.ceil(remaining / Math.max(1, topicPlan.length - index)))),
          lessonStep: node.title,
          progressionStep: node.lesson,
          vocabularyHints: [...new Set([...node.recommendedVocabulary, ...node.grammarTargets, ...node.interestTags])],
        });
        const generatedIds = generated.map((word) => word.id);
        generatedAny = generatedAny || generatedIds.length > 0;
        await VocabularyWord.updateMany(
          { _id: { $in: generatedIds } },
          {
            $addToSet: {
              roadmapNodeIds: String(node._id),
              interestTags: { $each: [...node.interestTags, topic] },
            },
            $set: {
              lessonStep: node.title,
              scriptStage: node.scriptFocus ?? user.scriptStage,
              grammarTags: node.grammarTargets,
            },
          }
        );
      } catch (error) {
        if (index === topicPlan.length - 1 && !generatedAny && words.length < MIN_LESSON_WORDS) {
          const message = error instanceof Error ? error.message : String(error);
          throw new AppError(`AI word generation is required for this lesson: ${message}`, 503);
        }
      }

      words = await VocabularyWord.find({
        ...LESSON_WORD_SOURCE_FILTER,
        language,
        nativeLanguage,
        cefrLevel: node.level,
        roadmapNodeIds: String(node._id),
      })
        .sort({ progressionStep: 1, createdAt: 1 })
        .limit(TARGET_LESSON_WORDS)
        .lean({ virtuals: true }) as unknown as IVocabularyWord[];
    }
  }

  if (words.length < 4) {
    throw new AppError("AI did not generate enough lesson words for this roadmap node", 503);
  }

  return words.map((word) => asVocabularyWord(word as unknown as Record<string, unknown>));
}

function buildRuntimeMediaTask(node: ICurriculumNode, user: IUser, words: IVocabularyWord[]): IMediaTask | null {
  if (user.currentLevel === "A1") return null;

  const targetLanguage = normalizeLanguageCode(user.studyLanguage, "en");
  const topic = normalizeTopic(node.interestTags[0] ?? words[0]?.topic ?? "daily life");
  const curated = pickCuratedMediaTask({
    tasks: getCuratedMediaTasksForLanguage(targetLanguage),
    level: node.level,
    topics: [topic, ...words.map((word) => normalizeTopic(word.topic))],
    seed: `${node._id}|${user._id}|${topic}`,
  });

  if (!curated) return null;

  const id = `runtime:${curated._id}`;

  return {
    _id: id,
    id,
    sourceUrl: curated.sourceUrl,
    provider: curated.provider,
    clipTitle: curated.clipTitle,
    transcriptSegment: curated.transcriptSegment,
    startSeconds: curated.startSeconds,
    endSeconds: curated.endSeconds,
    difficulty: curated.difficulty,
    level: curated.level,
    language: curated.language,
    topic: curated.topic,
    roadmapNodeIds: [String(node._id)],
    skillFocus: curated.skillFocus,
    exerciseTypes: curated.exerciseTypes,
    questions: curated.questions,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as IMediaTask;
}

function getLevelDistance(left: CefrLevel, right: CefrLevel): number {
  const order: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
  return Math.abs(order.indexOf(left) - order.indexOf(right));
}

function pickByStableSeed<T>(items: T[], seed: string): T | null {
  if (items.length === 0) return null;
  const value = parseInt(crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  return items[value % items.length] ?? null;
}

function pickCuratedMediaTask<T extends Pick<IMediaTask, "level" | "topic">>(params: {
  tasks: T[];
  level: CefrLevel;
  topics: string[];
  seed: string;
}): T | null {
  const topics = new Set(params.topics.map((topic) => normalizeTopic(topic)).filter(Boolean));
  const exactTopic = params.tasks.filter((task) => topics.has(normalizeTopic(String(task.topic))));
  const topicPool = exactTopic.length > 0 ? exactTopic : params.tasks;
  const sorted = [...topicPool].sort((left, right) => {
    const levelDelta = getLevelDistance(left.level, params.level) - getLevelDistance(right.level, params.level);
    if (levelDelta !== 0) return levelDelta;
    return normalizeTopic(String(left.topic)).localeCompare(normalizeTopic(String(right.topic)));
  });
  const closestDistance = sorted[0] ? getLevelDistance(sorted[0].level, params.level) : 0;
  const closest = sorted.filter((task) => getLevelDistance(task.level, params.level) === closestDistance);
  return pickByStableSeed(closest, params.seed);
}

async function getMediaForNode(node: ICurriculumNode, user: IUser, words: IVocabularyWord[]): Promise<IMediaTask | null> {
  const language = normalizeLanguageCode(user.studyLanguage, "en");
  const topics = [...new Set([normalizeTopic(node.interestTags[0]), ...words.map((word) => normalizeTopic(word.topic))].filter(Boolean))];

  const existing = await MediaTask.find({
    isActive: true,
    provider: { $ne: "youtube" },
    sourceUrl: { $not: YOUTUBE_SOURCE_URL_PATTERN },
    language,
    level: node.level,
    $or: [
      { roadmapNodeIds: String(node._id) },
      { topic: { $in: topics } },
    ],
  })
    .sort({ difficulty: 1, updatedAt: -1 })
    .limit(12)
    .lean({ virtuals: true }) as unknown as IMediaTask[];

  const selected = pickCuratedMediaTask({
    tasks: existing,
    level: node.level,
    topics,
    seed: `${node._id}|${user._id}|${topics.join("|")}`,
  }) as IMediaTask | null;

  return selected ?? buildRuntimeMediaTask(node, user, words);
}

function getExercisePlan(
  node: ICurriculumNode,
  user: IUser,
  options: { limit?: number; recentTemplateFamilies?: Set<string> } = {}
) {
  const limit = options.limit ?? 18;
  const recentTemplateFamilies = options.recentTemplateFamilies ?? new Set<string>();
  const nodeTypeWeights = new Map(
    node.exerciseMix.map((item) => [item.type as ExerciseType, item.weight])
  );
  const nodeTypes = node.exerciseMix.map((item) => item.type as ExerciseType);
  const recommended = getRecommendedExerciseTypes({
    level: user.currentLevel,
    learnerStage: user.learnerStage,
    scriptStage: user.scriptStage,
    language: normalizeLanguageCode(user.studyLanguage, "en"),
    limit: 30,
  });
  const candidates = [...new Set([...nodeTypes, ...recommended])];
  const rankType = (type: ExerciseType) => {
    const metadata = getExerciseMetadata(type);
    const nodeWeight = nodeTypeWeights.get(type) ?? 0;
    const recentPenalty = recentTemplateFamilies.has(metadata.templateFamily) ? 4 : 0;
    return recentPenalty - nodeWeight * 2 + metadata.defaultDifficulty * 0.15;
  };
  const sorted = [...candidates].sort((left, right) => rankType(left) - rankType(right));
  const selected: ExerciseType[] = [];
  const addBest = (predicate: (type: ExerciseType) => boolean) => {
    const next = sorted.find((type) => predicate(type) && !selected.includes(type));
    if (next) selected.push(next);
  };

  for (const skill of [
    ...node.skillFocus,
    "vocabulary",
    "grammar",
    "reading",
    "writing",
    "listening",
    "script",
  ]) {
    addBest((type) => getExerciseMetadata(type).skill === skill);
  }

  for (const mode of ["exact", "auto", "ai", "rubric"] as const) {
    addBest((type) => getExerciseMetadata(type).evaluationMode === mode);
  }

  for (const type of sorted) {
    if (selected.length >= limit) break;
    if (!selected.includes(type)) selected.push(type);
  }

  return selected.slice(0, limit);
}

async function buildExercises(params: {
  user: IUser;
  node: ICurriculumNode;
  words: IVocabularyWord[];
  mode: "lesson" | "review" | "challenge";
}) {
  const targetLanguage = normalizeLanguageCode(params.user.studyLanguage, "en");
  const nativeLanguage = normalizeLanguageCode(params.user.nativeLanguage, "ru");
  const recent = await getRecentQuestionHashes(params.user._id, targetLanguage, nativeLanguage);
  const media = await getMediaForNode(params.node, params.user, params.words);
  const plan = getExercisePlan(params.node, params.user, {
    limit: params.mode === "challenge" ? 20 : 18,
    recentTemplateFamilies: recent.templateFamilies,
  });
  const mediaPreferredTypes: ExerciseType[] =
    media
      ? [
          "transcript_gap_fill",
          "media_transcript",
          ...(params.user.currentLevel === "B1" || params.user.currentLevel === "B2" || params.user.currentLevel === "C1" || params.user.currentLevel === "C2"
            ? (["media_comprehension"] as ExerciseType[])
            : []),
        ]
      : [];
  const filteredPlan = [...new Set([...mediaPreferredTypes, ...plan])].filter((type) => {
    const needs = getExerciseMetadata(type).mediaNeeds;
    if (needs === "audio") return false;
    if (needs === "video") return Boolean(media);
    return true;
  });

  try {
    const exercises = await generateRoadmapExercises({
      user: params.user,
      node: params.node,
      words: params.words,
      mode: params.mode,
      exerciseTypes: filteredPlan,
      media,
      recentQuestionHashes: [...recent.hashes],
      recentWordIds: [...recent.wordIds],
      count: params.mode === "challenge" ? 16 : 14,
    });

    const freshExercises = exercises.filter((exercise) => !recent.hashes.has(exercise.questionHash));
    return freshExercises.length >= 4 ? freshExercises : exercises;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AppError(`AI exercise generation is required for roadmap practice: ${message}`, 503);
  }
}

function buildLessonScriptSupport(user: IUser) {
  return {
    language: normalizeLanguageCode(user.studyLanguage, "en"),
    scriptStage: user.scriptStage,
    romajiAllowed: user.studyLanguage === "ja" && ["romaji", "kana_intro"].includes(user.scriptStage),
    kanjiPolicy:
      user.studyLanguage === "ja" && ["romaji", "kana_intro", "kana_supported"].includes(user.scriptStage)
        ? "avoid_heavy_kanji"
        : "kanji_with_reading_support",
  };
}

function buildContinueLessonCacheKey(userId: string, nodeId: string) {
  return `continue:${userId}:${nodeId}`;
}

function buildPracticeCacheKey(userId: string, nodeId: string, mode: "lesson" | "review" | "challenge") {
  return `practice:${userId}:${nodeId}:${mode}`;
}

function toStoredLessonPayload(params: {
  node: ICurriculumNode;
  focusWords: IVocabularyWord[];
  exercises: Awaited<ReturnType<typeof buildExercises>>;
  phase?: string;
  scriptSupport?: Record<string, unknown>;
}): StoredLessonPayload {
  return {
    node: params.node as unknown as Record<string, unknown>,
    focusWords: params.focusWords as unknown as Record<string, unknown>[],
    exercises: params.exercises as unknown as Array<Record<string, unknown>>,
    phase: params.phase,
    scriptSupport: params.scriptSupport,
  };
}

function throwFriendlyExerciseError(message: string): never {
  throw new AppError(message, 503);
}

export async function getContinueLesson(userId: string) {
  const user = await getUserOrThrow(userId);
  const node = await getCurrentNode(user);
  const cacheKey = buildContinueLessonCacheKey(userId, String(node._id));
  const cachedLesson = await getCachedExerciseSession(userId, cacheKey);

  try {
    const words = await getLessonWords(user, node);
    const introducedWordIds = await introduceWordsForNode(userId, node, words.slice(0, 12));
    await UserRoadmapProgress.findOneAndUpdate(
      { userId, nodeId: String(node._id) },
      {
        $addToSet: { introducedWordIds: { $each: introducedWordIds } },
        $set: { status: "in_progress", lastPracticedAt: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const exercises = await buildExercises({ user, node, words, mode: "lesson" });
    const scriptSupport = buildLessonScriptSupport(user);

    return createExerciseSession({
      userId,
      source: "continue_lesson",
      cacheKey,
      roadmapNodeId: String(node._id),
      mode: "lesson",
      payload: toStoredLessonPayload({
        node,
        focusWords: words.slice(0, 12),
        exercises,
        phase: "introduction_recognition_controlled_production_review",
        scriptSupport,
      }),
    });
  } catch {
    if (cachedLesson) {
      return cachedLesson;
    }
    throwFriendlyExerciseError(
      "Continue lesson is temporarily unavailable right now. Please try again shortly."
    );
  }
}

export async function getStageAwarePractice(userId: string, mode: "lesson" | "review" | "challenge" = "lesson") {
  const user = await getUserOrThrow(userId);
  const node = await getCurrentNode(user);
  const cacheKey = buildPracticeCacheKey(userId, String(node._id), mode);
  const cachedPractice = await getCachedExerciseSession(userId, cacheKey);

  try {
    const lessonWords = await getLessonWords(user, node);
    const reviewRecords = await UserWord.find({
      userId,
      $or: [
        { status: "DIFFICULT" },
        { nextReviewAt: { $lte: new Date() } },
        { masteryState: { $in: ["practicing", "reviewing"] } },
      ],
    })
      .sort({ nextReviewAt: 1, updatedAt: 1 })
      .limit(12)
      .populate("wordId")
      .lean({ virtuals: true });

    const reviewWords = reviewRecords
      .map((record) => record.wordId as unknown)
      .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null)
      .map((word) => asVocabularyWord(word));

    const words = mode === "review" && reviewWords.length >= 3 ? reviewWords : lessonWords;
    const exercises = await buildExercises({ user, node, words, mode });

    return createExerciseSession({
      userId,
      source: "roadmap_practice",
      cacheKey,
      roadmapNodeId: String(node._id),
      mode,
      payload: toStoredLessonPayload({
        node,
        focusWords: words.slice(0, 12),
        exercises,
        phase: mode,
      }),
    });
  } catch {
    if (cachedPractice) {
      return cachedPractice;
    }
    throwFriendlyExerciseError(
      "Roadmap practice is temporarily unavailable right now. Please try again shortly."
    );
  }
}

function getReviewIntervalMs(timesReviewed: number, accuracy: number) {
  if (accuracy < 0.5) return 24 * 60 * 60 * 1000;
  const days = REVIEW_INTERVALS_DAYS[Math.min(timesReviewed - 1, REVIEW_INTERVALS_DAYS.length - 1)];
  return days * 24 * 60 * 60 * 1000;
}

function isPersistableWordId(wordId: string) {
  return !wordId.startsWith("media:") && !wordId.startsWith("lesson:");
}

async function updateWordMemory(userId: string, results: VerifiedPracticeResult[], roadmapNodeId?: string) {
  for (const result of results) {
    if (!result.countedInScore) continue;
    if (!isPersistableWordId(result.wordId)) continue;

    const existing = await UserWord.findOne({ userId, wordId: result.wordId });
    if (existing) {
      const timesReviewed = existing.timesReviewed + 1;
      const correctCount = existing.correctCount + (result.correct ? 1 : 0);
      const accuracy = correctCount / timesReviewed;
      const status =
        accuracy >= 0.8 && timesReviewed >= 3
          ? "LEARNED"
          : accuracy < 0.4 && timesReviewed >= 2
            ? "DIFFICULT"
            : "LEARNING";
      const masteryState =
        status === "LEARNED" ? "mastered" : accuracy >= 0.6 ? "reviewing" : "practicing";

      await UserWord.findOneAndUpdate(
        { userId, wordId: result.wordId },
        {
          $set: {
            timesReviewed,
            correctCount,
            status,
            masteryState,
            lastPracticedAt: new Date(),
            lastSeenRoadmapNodeId: roadmapNodeId,
            nextReviewAt: new Date(Date.now() + getReviewIntervalMs(timesReviewed, accuracy)),
            ...(status === "LEARNED" && !existing.learnedAt ? { learnedAt: new Date() } : {}),
          },
          $addToSet: {
            ...(roadmapNodeId ? { roadmapNodeIds: roadmapNodeId } : {}),
            ...(result.templateFamily ? { templateFamiliesSeen: result.templateFamily } : {}),
          },
        }
      );
    } else {
      await UserWord.create({
        userId,
        wordId: result.wordId,
        status: result.correct ? "LEARNING" : "DIFFICULT",
        timesReviewed: 1,
        correctCount: result.correct ? 1 : 0,
        lastPracticedAt: new Date(),
        introducedAt: new Date(),
        introducedBy: "practice",
        firstSeenRoadmapNodeId: roadmapNodeId,
        lastSeenRoadmapNodeId: roadmapNodeId,
        roadmapNodeIds: roadmapNodeId ? [roadmapNodeId] : [],
        masteryState: result.correct ? "practicing" : "introduced",
        progressionStep: result.correct ? 2 : 1,
        exposureCount: 1,
        templateFamiliesSeen: result.templateFamily ? [result.templateFamily] : [],
      });
    }
  }
}

async function updateStreak(user: IUser) {
  const now = new Date();
  const last = user.lastStudiedAt;
  let streak = user.streak || 0;

  if (!last) {
    streak = 1;
  } else {
    const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 1) streak += 1;
    if (days > 1) streak = 1;
  }

  await User.findByIdAndUpdate(user._id, { $set: { streak, lastStudiedAt: now } });
}

async function advanceRoadmapIfReady(params: {
  user: IUser;
  roadmapNodeId: string;
  score: number;
  progressRatio: number;
  results: VerifiedPracticeResult[];
}) {
  const completed = params.progressRatio >= 0.7;
  const completedExerciseTypes = [
    ...new Set(params.results.map((result) => result.questionType).filter(Boolean) as string[]),
  ];

  const progress = await UserRoadmapProgress.findOneAndUpdate(
    { userId: params.user._id, nodeId: params.roadmapNodeId },
    {
      $set: {
        status: completed ? "completed" : "in_progress",
        progressPercent: completed ? 100 : Math.max(40, Math.round(params.progressRatio * 90)),
        lastScore: params.score,
        lastPracticedAt: new Date(),
        ...(completed ? { completedAt: new Date() } : {}),
      },
      $max: { bestScore: params.score },
      $inc: { attempts: 1 },
      $addToSet: { completedExerciseTypes: { $each: completedExerciseTypes } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (completed) {
    const language = normalizeLanguageCode(params.user.studyLanguage, "en");
    const currentNode = await CurriculumNode.findById(params.roadmapNodeId).lean();
    const nextNode = currentNode
      ? await CurriculumNode.findOne({
          language,
          isActive: true,
          stageOrder: { $gt: currentNode.stageOrder },
        })
          .sort({ stageOrder: 1 })
          .lean()
      : null;

    if (nextNode) {
      await UserRoadmapProgress.findOneAndUpdate(
        { userId: params.user._id, nodeId: String(nextNode._id) },
        {
          $setOnInsert: {
            userId: params.user._id,
            nodeId: String(nextNode._id),
          },
          $set: {
            status: "available",
            unlockedAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await User.findByIdAndUpdate(params.user._id, {
        $set: { currentRoadmapNodeId: String(nextNode._id) },
      });
    }
  }

  return progress;
}

export async function submitLearningResults(userId: string, payload: LessonSubmitPayload): Promise<unknown> {
  const user = await getUserOrThrow(userId);
  const targetLanguage = normalizeLanguageCode(user.studyLanguage, "en");
  const nativeLanguage = normalizeLanguageCode(user.nativeLanguage, "ru");
  const verified = await verifySubmittedResults({
    user,
    exerciseSessionId: payload.exerciseSessionId,
    submittedResults: payload.results ?? [],
  });
  const roadmapNodeId = payload.roadmapNodeId ?? user.currentRoadmapNodeId;

  await updateWordMemory(userId, verified.results, roadmapNodeId);

  const session = await LearningSession.create({
    userId,
    sessionType: payload.sessionType ?? "GUIDED_LESSON",
    targetLanguage,
    nativeLanguage,
    cefrLevel: user.currentLevel,
    topic: normalizeTopic(user.interests?.[0]),
    roadmapNodeId,
    learnerStage: user.learnerStage,
    scriptStage: user.scriptStage,
    wordsReviewed: verified.total,
    correctCount: verified.correctCount,
    evaluatedCount: verified.evaluatedCount,
    pendingReviewCount: verified.pendingReviewCount,
    score: verified.score,
    endedAt: new Date(),
    durationSecs: payload.durationSecs,
    wordsAsked: [
      ...new Set(
        verified.results
          .map((result) => result.wordId)
          .filter((wordId) => isPersistableWordId(wordId))
      ),
    ],
    questionHashes: [
      ...new Set(verified.results.map((result) => result.questionHash).filter(Boolean) as string[]),
    ],
    exerciseTypes: verified.exerciseTypes,
    templateFamilies: verified.templateFamilies,
    answerRecords: verified.results,
  });

  let progress;
  if (roadmapNodeId) {
    progress = await advanceRoadmapIfReady({
      user,
      roadmapNodeId,
      score: verified.score,
      progressRatio: verified.progressRatio,
      results: verified.results,
    });
  }

  await updateStreak(user);

  return {
    session,
    score: verified.score,
    correctCount: verified.correctCount,
    evaluatedCount: verified.evaluatedCount,
    pendingReviewCount: verified.pendingReviewCount,
    total: verified.total,
    progress,
  };
}

export async function getMediaTasks(userId: string): Promise<IMediaTask[]> {
  const user = await getUserOrThrow(userId);
  const node = await getCurrentNode(user);
  const words = await getLessonWords(user, node);
  const media = await getMediaForNode(node, user, words);
  return media ? [media] : [];
}

export async function setCurrentRoadmapNode(userId: string, nodeId: string): Promise<unknown> {
  const user = await getUserOrThrow(userId);
  const node = await CurriculumNode.findById(nodeId);
  if (!node) throw new AppError("Roadmap node not found", 404);
  const userLanguage = normalizeLanguageCode(user.studyLanguage, "en");
  const nodeLanguage = normalizeLanguageCode(node.language, "en");

  if (nodeLanguage !== userLanguage) {
    throw new AppError("You can only switch to roadmap nodes in your current study language", 400);
  }

  const roadmap = await getRoadmap(userId);
  const roadmapNode = roadmap.nodes.find((item) => String(item._id) === String(node._id));

  if (!roadmapNode) {
    throw new AppError("This roadmap node is not available for your current learning path", 400);
  }

  if (roadmapNode.progress?.status === "locked") {
    throw new AppError("This roadmap node is still locked. Complete earlier lessons to unlock it", 403);
  }

  await UserRoadmapProgress.findOneAndUpdate(
    { userId, nodeId },
    {
      $setOnInsert: {
        userId,
        nodeId,
        unlockedAt: new Date(),
      },
      $set: {
        status: "in_progress",
        startedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  user.currentRoadmapNodeId = nodeId;
  await user.save();

  return getDashboard(userId);
}
