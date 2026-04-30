import crypto from "crypto";
import {
  CurriculumNode,
  PlacementItem,
  PlacementSession,
  User,
  UserRoadmapProgress,
} from "../../models";
import type {
  CefrLevel,
  IPlacementAnswerRecord,
  IPlacementItem,
  IPlacementResult,
  ISubskillProfile,
  LearnerStage,
  ScriptStage,
  SkillFocus,
} from "../../models";
import { AppError } from "../../middleware/errorHandler";
import { normalizeLanguageCode, normalizeTopics } from "../../utils/language";
import { seedLearningFoundation } from "../../seeds/learningSeed";
import { generatePlacementItemWithAi } from "../ai/ai.service";

interface StartPlacementInput {
  studyLanguage: string;
  nativeLanguage: string;
  interests?: string[];
  learningGoal?: string;
  preferredContentStyle?: string;
}

interface ManualPlacementInput extends StartPlacementInput {
  currentLevel: CefrLevel;
}

const LEVEL_BY_DIFFICULTY: CefrLevel[] = ["A1", "A1", "A2", "B1", "B2", "C1", "C2"];
type ScoredSubskill = Exclude<keyof ISubskillProfile, "updatedAt">;

const SUBSKILL_KEYS: ScoredSubskill[] = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "writing",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function seededIndex(seed: string, max: number) {
  if (max <= 0) return 0;
  return parseInt(crypto.createHash("md5").update(seed).digest("hex").slice(0, 8), 16) % max;
}

function getVariant(item: IPlacementItem, sessionSeed: string, askedCount: number) {
  const all = [
    {
      prompt: item.prompt,
      choices: item.choices,
      correctAnswer: item.correctAnswer,
      acceptedAnswers: item.acceptedAnswers,
    },
    ...(item.variants ?? []),
  ];
  const variantIndex = seededIndex(`${sessionSeed}|${item.itemKey}|${askedCount}`, all.length);
  return {
    variantIndex,
    variant: all[variantIndex],
  };
}

function getVariantByIndex(item: IPlacementItem, variantIndex: number) {
  const all = [
    {
      prompt: item.prompt,
      choices: item.choices,
      correctAnswer: item.correctAnswer,
      acceptedAnswers: item.acceptedAnswers,
    },
    ...(item.variants ?? []),
  ];
  return all[clamp(variantIndex, 0, all.length - 1)];
}

async function ensurePlacementBank(language: string) {
  await seedLearningFoundation(language);
}

function toPublicPlacementItem(session: { _id: string; answeredCount: number; targetItemCount: number }, record: IPlacementAnswerRecord, item: IPlacementItem) {
  return {
    sessionId: String(session._id),
    itemId: record.itemId,
    itemKey: record.itemKey,
    type: record.type,
    skill: record.skill,
    difficulty: record.difficulty,
    cefrLevel: record.cefrLevel,
    prompt: record.prompt,
    passage: item.passage,
    choices: record.type === "short_production" ? [] : item.choices,
    progress: {
      answered: session.answeredCount,
      target: session.targetItemCount,
    },
  };
}

function evaluatePlacementAnswer(item: IPlacementItem, record: IPlacementAnswerRecord, answer: string) {
  const variant = getVariantByIndex(item, record.variantIndex);
  const accepted = [
    ...(variant.acceptedAnswers ?? []),
    ...(item.acceptedAnswers ?? []),
    variant.correctAnswer,
    item.correctAnswer,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeAnswer);
  const normalized = normalizeAnswer(answer);

  if (record.type === "short_production") {
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    const hasEnoughSignal = wordCount >= 5 || normalized.length >= 24;
    const hasRelevantCue = item.topics.some((topic) => normalized.includes(topic.replace(/\s+/g, " ")));
    const score = hasEnoughSignal ? (hasRelevantCue ? 0.85 : 0.7) : normalized.length > 8 ? 0.45 : 0.15;
    return {
      correct: score >= 0.65,
      score,
      feedback:
        score >= 0.65
          ? "The response gives enough signal for placement."
          : "The response is short, so confidence is lower.",
    };
  }

  const correct = accepted.some((expected) => expected === normalized);
  return {
    correct,
    score: correct ? 1 : 0,
    feedback: correct ? "Correct." : "Not quite.",
  };
}

function getLearnerStage(level: CefrLevel, averageScore: number): LearnerStage {
  if (level === "A1") {
    if (averageScore < 0.35) return "absolute_beginner";
    if (averageScore < 0.68) return "early_beginner";
    return "late_beginner";
  }
  if (level === "A2") return "late_beginner";
  if (level === "B1") return "intermediate";
  if (level === "B2") return "upper_intermediate";
  return "advanced";
}

function getScriptStage(language: string, level: CefrLevel, subskills: ISubskillProfile): ScriptStage {
  if (language !== "ja") {
    return ["zh", "ko"].includes(language) ? "native_script" : "latin";
  }

  const scriptSignal = Math.max(subskills.reading, subskills.vocabulary);
  if (level === "A1") {
    if (scriptSignal < 0.3) return "romaji";
    if (scriptSignal < 0.65) return "kana_intro";
    return "kana_supported";
  }
  if (level === "A2") return scriptSignal < 0.6 ? "kana_supported" : "kanji_intro";
  if (level === "B1") return "kanji_intro";
  if (level === "B2") return "kanji_supported";
  return "kanji_confident";
}

function scoreToLevel(records: IPlacementAnswerRecord[]): CefrLevel {
  if (records.length === 0) return "A1";
  const weightedDifficulty =
    records.reduce((sum, record) => sum + record.difficulty * (record.score ?? 0), 0) / records.length;

  if (weightedDifficulty < 1.45) return "A1";
  if (weightedDifficulty < 2.25) return "A2";
  if (weightedDifficulty < 3.15) return "B1";
  if (weightedDifficulty < 4.15) return "B2";
  if (weightedDifficulty < 5.05) return "C1";
  return "C2";
}

function computeSubskills(records: IPlacementAnswerRecord[]): ISubskillProfile {
  const profile: ISubskillProfile = {
    vocabulary: 0,
    grammar: 0,
    reading: 0,
    listening: 0,
    writing: 0,
    updatedAt: new Date(),
  };

  for (const key of SUBSKILL_KEYS) {
    const skillRecords = records.filter((record) =>
      key === "vocabulary"
        ? record.skill === "vocabulary" || record.skill === "script"
        : record.skill === key
    );
    if (skillRecords.length === 0) {
      profile[key] = key === "listening" ? 0.15 : 0.25;
      continue;
    }
    profile[key] =
      skillRecords.reduce((sum, record) => sum + (record.score ?? 0), 0) / skillRecords.length;
  }

  return profile;
}

async function recommendRoadmapNode(language: string, level: CefrLevel, learnerStage: LearnerStage) {
  return (
    (await CurriculumNode.findOne({ language, level, learnerStage, isActive: true })
      .sort({ stageOrder: 1 })
      .lean({ virtuals: true })) ??
    (await CurriculumNode.findOne({ language, level, isActive: true })
      .sort({ stageOrder: 1 })
      .lean({ virtuals: true })) ??
    (await CurriculumNode.findOne({ language, isActive: true })
      .sort({ stageOrder: 1 })
      .lean({ virtuals: true }))
  );
}

async function persistPlacementResult(params: {
  userId: string;
  language: string;
  nativeLanguage: string;
  interests?: string[];
  learningGoal?: string;
  preferredContentStyle?: string;
  result: IPlacementResult;
  source: "manual" | "placement_test";
}) {
  const update = {
    studyLanguage: params.language,
    nativeLanguage: params.nativeLanguage,
    currentLevel: params.result.estimatedLevel,
    placementSource: params.source,
    placementConfidence: params.result.confidence,
    subskillProfile: params.result.subskillProfile,
    learnerStage: params.result.learnerStage,
    scriptStage: params.result.scriptStage,
    interests: normalizeTopics(params.interests),
    learningGoal: params.learningGoal,
    preferredContentStyle: params.preferredContentStyle ?? "balanced",
    currentRoadmapNodeId: params.result.recommendedRoadmapNodeId,
    onboardingDone: true,
    onboardingVersion: "learning_v1",
  };

  const user = await User.findByIdAndUpdate(params.userId, { $set: update }, { new: true });
  if (!user) throw new AppError("User not found", 404);

  if (params.result.recommendedRoadmapNodeId) {
    await UserRoadmapProgress.findOneAndUpdate(
      { userId: params.userId, nodeId: params.result.recommendedRoadmapNodeId },
      {
        $setOnInsert: {
          userId: params.userId,
          nodeId: params.result.recommendedRoadmapNodeId,
          unlockedAt: new Date(),
        },
        $set: {
          status: "in_progress",
          startedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return user.toJSON();
}

export async function startPlacement(userId: string, input: StartPlacementInput) {
  const language = normalizeLanguageCode(input.studyLanguage, "en");
  const nativeLanguage = normalizeLanguageCode(input.nativeLanguage, "ru");
  await ensurePlacementBank(language);

  await PlacementSession.updateMany(
    { userId, status: "active" },
    { $set: { status: "abandoned" } }
  );

  await User.findByIdAndUpdate(userId, {
    $set: {
      studyLanguage: language,
      nativeLanguage,
      interests: normalizeTopics(input.interests),
      learningGoal: input.learningGoal,
      preferredContentStyle: input.preferredContentStyle ?? "balanced",
    },
  });

  const session = await PlacementSession.create({
    userId,
    language,
    nativeLanguage,
    status: "active",
    seed: crypto.randomBytes(8).toString("hex"),
    currentDifficulty: 2,
    targetItemCount: language === "ja" ? 9 : 8,
  });

  return session.toJSON();
}

async function createAiPlacementItem(params: {
  userId: string;
  language: string;
  nativeLanguage: string;
  skill: SkillFocus;
  difficulty: number;
  answeredCount: number;
  sessionSeed: string;
  avoidItemFamilies: string[];
}) {
  const user = await User.findById(params.userId).lean();

  try {
    const generated = await generatePlacementItemWithAi({
      language: params.language,
      nativeLanguage: params.nativeLanguage,
      skill: params.skill,
      difficulty: params.difficulty,
      answeredCount: params.answeredCount,
      seed: params.sessionSeed,
      interests: user?.interests ?? [],
      learningGoal: user?.learningGoal,
      avoidItemFamilies: params.avoidItemFamilies,
    });

    return (await PlacementItem.findOneAndUpdate(
      { itemKey: generated.itemKey },
      { $set: { ...generated, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean({ virtuals: true })) as unknown as IPlacementItem;
  } catch {
    throw new AppError(
      "Placement generation is temporarily unavailable right now. Please try again shortly.",
      503
    );
  }
}

export async function getNextPlacementItem(userId: string, sessionId: string) {
  const session = await PlacementSession.findOne({ _id: sessionId, userId });
  if (!session) throw new AppError("Placement session not found", 404);
  if (session.status !== "active") {
    return { complete: true, result: session.result };
  }

  const pending = session.askedItems.find((item) => item.score === undefined);
  if (pending) {
    const item = await PlacementItem.findById(pending.itemId).lean({ virtuals: true });
    if (!item) throw new AppError("Placement item not found", 404);
    return { complete: false, item: toPublicPlacementItem(session, pending, item as unknown as IPlacementItem) };
  }

  if (session.answeredCount >= session.targetItemCount) {
    return { complete: true };
  }

  const skillCycle: SkillFocus[] =
    session.language === "ja"
      ? ["vocabulary", "script", "grammar", "reading", "writing"]
      : ["vocabulary", "grammar", "reading", "writing"];
  const desiredSkill = skillCycle[session.answeredCount % skillCycle.length];
  const askedIds = session.askedItems.map((item) => item.itemId);
  const askedFamilies = session.askedItems.map((item) => item.itemFamily);
  const difficulty = clamp(session.currentDifficulty, 1, 6);
  const query = {
    language: session.language,
    nativeLanguage: session.nativeLanguage,
    isActive: true,
    itemKey: /^ai:/,
    _id: { $nin: askedIds },
    itemFamily: { $nin: askedFamilies },
    difficulty: { $gte: Math.max(1, difficulty - 1), $lte: Math.min(6, difficulty + 1) },
  };

  let candidates = await PlacementItem.find({ ...query, skill: desiredSkill }).lean({ virtuals: true });
  if (candidates.length === 0) {
    candidates = await PlacementItem.find({ ...query }).lean({ virtuals: true });
  }
  if (candidates.length === 0) {
    candidates = await PlacementItem.find({
      language: session.language,
      nativeLanguage: session.nativeLanguage,
      isActive: true,
      itemKey: /^ai:/,
      _id: { $nin: askedIds },
    }).lean({ virtuals: true });
  }

  const item = candidates.length > 0
    ? (candidates[
        seededIndex(`${session.seed}|${session.answeredCount}|${desiredSkill}`, candidates.length)
      ] as unknown as IPlacementItem)
    : await createAiPlacementItem({
        userId,
        language: session.language,
        nativeLanguage: session.nativeLanguage,
        skill: desiredSkill,
        difficulty,
        answeredCount: session.answeredCount,
        sessionSeed: session.seed,
        avoidItemFamilies: askedFamilies,
      });
  const { variantIndex, variant } = getVariant(item, session.seed, session.answeredCount);
  const record: IPlacementAnswerRecord = {
    itemId: String(item._id),
    itemKey: item.itemKey,
    type: item.type,
    skill: item.skill,
    difficulty: item.difficulty,
    cefrLevel: item.cefrLevel,
    itemFamily: item.itemFamily,
    variantIndex,
    prompt: variant.prompt,
  };

  session.askedItems.push(record);
  await session.save();

  return {
    complete: false,
    item: toPublicPlacementItem(session, record, {
      ...item,
      choices: variant.choices ?? item.choices,
    } as IPlacementItem),
  };
}

export async function submitPlacementAnswer(userId: string, sessionId: string, itemId: string, answer: string) {
  const session = await PlacementSession.findOne({ _id: sessionId, userId });
  if (!session) throw new AppError("Placement session not found", 404);
  if (session.status !== "active") throw new AppError("Placement session is not active", 400);

  const record = [...session.askedItems]
    .reverse()
    .find((item) => item.itemId === itemId && item.score === undefined);
  if (!record) throw new AppError("Placement item is not pending", 400);

  const item = await PlacementItem.findById(itemId);
  if (!item) throw new AppError("Placement item not found", 404);

  const evaluation = evaluatePlacementAnswer(item, record, answer);
  const target = session.askedItems.find((asked) => asked.itemId === itemId && asked.score === undefined);
  if (!target) throw new AppError("Placement item is not pending", 400);

  target.answer = answer;
  target.correct = evaluation.correct;
  target.score = evaluation.score;
  target.submittedAt = new Date();
  session.answeredCount += 1;
  session.currentDifficulty = clamp(
    session.currentDifficulty + (evaluation.score >= 0.75 ? 1 : evaluation.score <= 0.25 ? -1 : 0),
    1,
    6
  );
  session.markModified("askedItems");
  await session.save();

  return {
    evaluation,
    progress: {
      answered: session.answeredCount,
      target: session.targetItemCount,
      shouldFinish: session.answeredCount >= session.targetItemCount,
    },
  };
}

export async function finishPlacement(userId: string, sessionId: string) {
  const session = await PlacementSession.findOne({ _id: sessionId, userId });
  if (!session) throw new AppError("Placement session not found", 404);

  const answered = session.askedItems.filter((item) => item.score !== undefined);
  if (answered.length < 4) throw new AppError("Answer at least 4 placement items before finishing", 400);

  const language = normalizeLanguageCode(session.language, "en");
  await seedLearningFoundation(language);

  const subskillProfile = computeSubskills(answered);
  const estimatedLevel = scoreToLevel(answered);
  const averageScore = answered.reduce((sum, item) => sum + (item.score ?? 0), 0) / answered.length;
  const confidence = clamp(0.35 + (answered.length / session.targetItemCount) * 0.35 + Math.abs(averageScore - 0.5) * 0.25, 0.35, 0.95);
  const learnerStage = getLearnerStage(estimatedLevel, averageScore);
  const scriptStage = getScriptStage(language, estimatedLevel, subskillProfile);
  const node = await recommendRoadmapNode(language, estimatedLevel, learnerStage);
  const user = await User.findById(userId).lean();

  const result: IPlacementResult = {
    estimatedLevel,
    confidence,
    subskillProfile,
    recommendedRoadmapNodeId: node ? String(node._id) : undefined,
    learnerStage,
    scriptStage,
  };

  session.status = "finished";
  session.finishedAt = new Date();
  session.result = result;
  await session.save();

  const updatedUser = await persistPlacementResult({
    userId,
    language,
    nativeLanguage: normalizeLanguageCode(session.nativeLanguage, "ru"),
    interests: user?.interests ?? [],
    learningGoal: user?.learningGoal,
    preferredContentStyle: user?.preferredContentStyle,
    result,
    source: "placement_test",
  });

  return {
    result,
    user: updatedUser,
  };
}

export async function completeManualPlacement(userId: string, input: ManualPlacementInput) {
  const language = normalizeLanguageCode(input.studyLanguage, "en");
  const nativeLanguage = normalizeLanguageCode(input.nativeLanguage, "ru");
  await seedLearningFoundation(language);

  const averageScore = input.currentLevel === "A1" ? 0.42 : 0.55;
  const learnerStage = getLearnerStage(input.currentLevel, averageScore);
  const subskillProfile: ISubskillProfile = {
    vocabulary: averageScore,
    grammar: Math.max(0.2, averageScore - 0.05),
    reading: Math.max(0.2, averageScore - 0.05),
    listening: 0.2,
    writing: Math.max(0.15, averageScore - 0.15),
    updatedAt: new Date(),
  };
  const scriptStage = getScriptStage(language, input.currentLevel, subskillProfile);
  const node = await recommendRoadmapNode(language, input.currentLevel, learnerStage);
  const result: IPlacementResult = {
    estimatedLevel: input.currentLevel,
    confidence: 0.42,
    subskillProfile,
    recommendedRoadmapNodeId: node ? String(node._id) : undefined,
    learnerStage,
    scriptStage,
  };

  const user = await persistPlacementResult({
    userId,
    language,
    nativeLanguage,
    interests: input.interests,
    learningGoal: input.learningGoal,
    preferredContentStyle: input.preferredContentStyle,
    result,
    source: "manual",
  });

  return { result, user };
}
