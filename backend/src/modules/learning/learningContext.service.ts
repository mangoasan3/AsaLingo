import {
  CurriculumNode,
  LearningSession,
  User,
  UserRoadmapProgress,
  UserWord,
} from "../../models";
import type {
  CefrLevel,
  ICurriculumNode,
  ISubskillProfile,
  IUser,
  LearnerStage,
  ScriptStage,
} from "../../models";
import { AppError } from "../../middleware/errorHandler";
import { getLanguageName, normalizeLanguageCode } from "../../utils/language";
import { seedLearningFoundation } from "../../seeds/learningSeed";

interface ContextWord {
  id: string;
  word: string;
  translation: string;
  masteryState?: string;
  status?: string;
  roadmapNodeIds?: string[];
}

export interface LearningContext {
  userId: string;
  targetLanguage: string;
  targetLanguageName: string;
  nativeLanguage: string;
  nativeLanguageName: string;
  level: CefrLevel;
  placementSource: string;
  placementConfidence: number;
  subskillProfile: ISubskillProfile;
  learnerStage: LearnerStage;
  scriptStage: ScriptStage;
  isAbsoluteBeginner: boolean;
  interests: string[];
  learningGoal?: string;
  preferredContentStyle: string;
  currentRoadmapNode?: ICurriculumNode;
  currentProgress?: {
    status: string;
    progressPercent: number;
    bestScore?: number;
    attempts: number;
  };
  introducedVocabulary: ContextWord[];
  reviewVocabulary: ContextWord[];
  skillWeaknesses: Array<{ skill: keyof ISubskillProfile; score: number }>;
  recentExerciseTypes: string[];
  promptContext: string;
}

const SUBSKILL_KEYS: Array<keyof ISubskillProfile> = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "writing",
];

function normalizeSubskillProfile(profile?: Partial<ISubskillProfile>): ISubskillProfile {
  return {
    vocabulary: clampScore(profile?.vocabulary ?? 0.2),
    grammar: clampScore(profile?.grammar ?? 0.2),
    reading: clampScore(profile?.reading ?? 0.2),
    listening: clampScore(profile?.listening ?? 0.1),
    writing: clampScore(profile?.writing ?? 0.1),
    updatedAt: profile?.updatedAt,
  };
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getWeaknesses(profile: ISubskillProfile) {
  return SUBSKILL_KEYS.map((skill) => ({ skill, score: profile[skill] as number }))
    .filter((item) => item.score < 0.6)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3);
}

function toContextWord(record: Record<string, unknown>): ContextWord | null {
  const word = record.wordId as Record<string, unknown> | undefined;
  if (!word || typeof word !== "object") return null;

  return {
    id: String(word._id ?? word.id ?? ""),
    word: String(word.word ?? ""),
    translation: String(word.translation ?? ""),
    masteryState: String(record.masteryState ?? ""),
    status: String(record.status ?? ""),
    roadmapNodeIds: Array.isArray(record.roadmapNodeIds)
      ? record.roadmapNodeIds.map(String)
      : [],
  };
}

async function ensureCurrentNode(user: IUser, targetLanguage: string) {
  await seedLearningFoundation(targetLanguage);

  if (user.currentRoadmapNodeId) {
    const existing = await CurriculumNode.findById(user.currentRoadmapNodeId).lean({
      virtuals: true,
    });
    if (existing) return existing as unknown as ICurriculumNode;
  }

  const node =
    (await CurriculumNode.findOne({
      language: targetLanguage,
      level: user.currentLevel,
      learnerStage: user.learnerStage,
      isActive: true,
    })
      .sort({ stageOrder: 1 })
      .lean({ virtuals: true })) ??
    (await CurriculumNode.findOne({
      language: targetLanguage,
      level: user.currentLevel,
      isActive: true,
    })
      .sort({ stageOrder: 1 })
      .lean({ virtuals: true })) ??
    (await CurriculumNode.findOne({ language: targetLanguage, isActive: true })
      .sort({ stageOrder: 1 })
      .lean({ virtuals: true }));

  if (node) {
    await User.findByIdAndUpdate(user._id, { $set: { currentRoadmapNodeId: String(node._id) } });
  }

  return node as unknown as ICurriculumNode | null;
}

function buildPromptContext(context: Omit<LearningContext, "promptContext">) {
  const currentNode = context.currentRoadmapNode;
  const introduced = context.introducedVocabulary
    .slice(0, 18)
    .map((item) => `${item.word}=${item.translation}`)
    .join(", ");
  const review = context.reviewVocabulary
    .slice(0, 12)
    .map((item) => `${item.word}(${item.masteryState || item.status})`)
    .join(", ");
  const weaknesses = context.skillWeaknesses
    .map((item) => `${item.skill}:${item.score.toFixed(2)}`)
    .join(", ");

  return [
    "AsaLingo persistent learner context.",
    `Target language: ${context.targetLanguageName} (${context.targetLanguage}).`,
    `Native language: ${context.nativeLanguageName} (${context.nativeLanguage}).`,
    `Estimated level: ${context.level}; placement=${context.placementSource}; confidence=${context.placementConfidence.toFixed(2)}.`,
    `Learner stage: ${context.learnerStage}; absolute beginner=${context.isAbsoluteBeginner ? "yes" : "no"}.`,
    `Script stage: ${context.scriptStage}. For Japanese, respect this strictly: romaji means allow romaji and avoid kanji; kana_intro means scaffold kana; kanji stages require readings/support.`,
    currentNode
      ? `Current roadmap node: ${currentNode.nodeKey}; unit ${currentNode.unit}, lesson ${currentNode.lesson}; objective=${currentNode.objective}; scriptFocus=${currentNode.scriptFocus ?? "none"}.`
      : "Current roadmap node: none assigned.",
    `Interests: ${context.interests.length ? context.interests.join(", ") : "daily life, communication"}.`,
    `Learning goal: ${context.learningGoal || "general communication"}.`,
    `Preferred content style: ${context.preferredContentStyle}.`,
    `Introduced vocabulary: ${introduced || "none yet"}.`,
    `Words under review: ${review || "none yet"}.`,
    `Weak subskills: ${weaknesses || "none detected yet"}.`,
    `Recent exercise types: ${context.recentExerciseTypes.join(", ") || "none"}.`,
    "Generate content from this context; do not jump ahead of the learner stage or script stage.",
  ].join("\n");
}

export async function buildLearningContext(userId: string): Promise<LearningContext> {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  const targetLanguage = normalizeLanguageCode(user.studyLanguage, "en");
  const nativeLanguage = normalizeLanguageCode(user.nativeLanguage, "ru");

  if (user.studyLanguage !== targetLanguage || user.nativeLanguage !== nativeLanguage) {
    user.studyLanguage = targetLanguage;
    user.nativeLanguage = nativeLanguage;
    await user.save();
  }

  const currentRoadmapNode = await ensureCurrentNode(user, targetLanguage);

  const [progress, introducedRecords, reviewRecords, recentSessions] = await Promise.all([
    currentRoadmapNode
      ? UserRoadmapProgress.findOne({ userId, nodeId: currentRoadmapNode._id }).lean({
          virtuals: true,
        })
      : null,
    UserWord.find({ userId })
      .sort({ introducedAt: 1, updatedAt: 1 })
      .limit(40)
      .populate("wordId")
      .lean({ virtuals: true }),
    UserWord.find({
      userId,
      $or: [
        { status: "DIFFICULT" },
        { masteryState: { $in: ["practicing", "reviewing"] } },
        { nextReviewAt: { $lte: new Date() } },
      ],
    })
      .sort({ nextReviewAt: 1, updatedAt: 1 })
      .limit(24)
      .populate("wordId")
      .lean({ virtuals: true }),
    LearningSession.find({ userId, targetLanguage, nativeLanguage })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("exerciseTypes")
      .lean(),
  ]);

  const subskillProfile = normalizeSubskillProfile(user.subskillProfile);
  const contextBase: Omit<LearningContext, "promptContext"> = {
    userId,
    targetLanguage,
    targetLanguageName: getLanguageName(targetLanguage),
    nativeLanguage,
    nativeLanguageName: getLanguageName(nativeLanguage),
    level: user.currentLevel,
    placementSource: user.placementSource,
    placementConfidence: user.placementConfidence,
    subskillProfile,
    learnerStage: user.learnerStage,
    scriptStage: user.scriptStage,
    isAbsoluteBeginner: user.learnerStage === "absolute_beginner" || user.currentLevel === "A1",
    interests: user.interests ?? [],
    learningGoal: user.learningGoal,
    preferredContentStyle: user.preferredContentStyle,
    currentRoadmapNode: currentRoadmapNode ?? undefined,
    currentProgress: progress
      ? {
          status: String(progress.status),
          progressPercent: Number(progress.progressPercent ?? 0),
          bestScore:
            typeof progress.bestScore === "number" ? Number(progress.bestScore) : undefined,
          attempts: Number(progress.attempts ?? 0),
        }
      : undefined,
    introducedVocabulary: introducedRecords
      .map((record) => toContextWord(record as unknown as Record<string, unknown>))
      .filter((item): item is ContextWord => Boolean(item)),
    reviewVocabulary: reviewRecords
      .map((record) => toContextWord(record as unknown as Record<string, unknown>))
      .filter((item): item is ContextWord => Boolean(item)),
    skillWeaknesses: getWeaknesses(subskillProfile),
    recentExerciseTypes: [
      ...new Set(recentSessions.flatMap((session) => session.exerciseTypes ?? [])),
    ].slice(0, 8),
  };

  return {
    ...contextBase,
    promptContext: buildPromptContext(contextBase),
  };
}
