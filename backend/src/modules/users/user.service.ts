import { CurriculumNode, User, UserWord, LearningSession, UserRoadmapProgress } from "../../models";
import type { IUser, CefrLevel, LearnerStage, ScriptStage } from "../../models";
import { AppError } from "../../middleware/errorHandler";
import { normalizeLanguageCode, normalizeTopics } from "../../utils/language";
import { seedLearningFoundation } from "../../seeds/learningSeed";

async function normalizePersistedUser(user: IUser | null): Promise<IUser> {
  if (!user) throw new AppError("User not found", 404);

  const normalizedStudyLanguage = normalizeLanguageCode(user.studyLanguage, "en");
  const normalizedNativeLanguage = normalizeLanguageCode(user.nativeLanguage, "ru");

  if (
    user.studyLanguage !== normalizedStudyLanguage ||
    user.nativeLanguage !== normalizedNativeLanguage
  ) {
    user.studyLanguage = normalizedStudyLanguage;
    user.nativeLanguage = normalizedNativeLanguage;
    await user.save();
  }

  return user;
}

export async function getUserById(id: string): Promise<IUser> {
  const user = await normalizePersistedUser(await User.findById(id));
  return user.toJSON() as unknown as IUser;
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    currentLevel?: CefrLevel;
    studyLanguage?: string;
    nativeLanguage?: string;
    learningGoal?: string;
    interests?: string[];
    preferredContentStyle?: IUser["preferredContentStyle"];
  }
): Promise<IUser> {
  const updates = { ...data };
  if (updates.studyLanguage) updates.studyLanguage = normalizeLanguageCode(updates.studyLanguage, "en");
  if (updates.nativeLanguage) updates.nativeLanguage = normalizeLanguageCode(updates.nativeLanguage, "ru");
  if (updates.interests) updates.interests = normalizeTopics(updates.interests);

  const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true });
  const normalized = await normalizePersistedUser(user);
  return normalized.toJSON() as unknown as IUser;
}

export async function completeOnboarding(
  id: string,
  data: {
    studyLanguage: string;
    nativeLanguage: string;
    currentLevel: CefrLevel;
    interests?: string[];
    learningGoal?: string;
    preferredContentStyle?: IUser["preferredContentStyle"];
  }
): Promise<IUser> {
  const studyLanguage = normalizeLanguageCode(data.studyLanguage, "en");
  const nativeLanguage = normalizeLanguageCode(data.nativeLanguage, "ru");
  await seedLearningFoundation(studyLanguage);
  const learnerStage = getManualLearnerStage(data.currentLevel);
  const scriptStage = getManualScriptStage(studyLanguage, data.currentLevel);
  const node = await CurriculumNode.findOne({
    language: studyLanguage,
    level: data.currentLevel,
    learnerStage,
    isActive: true,
  })
    .sort({ stageOrder: 1 })
    .lean();

  const user = await User.findByIdAndUpdate(
    id,
    {
      $set: {
        ...data,
        studyLanguage,
        nativeLanguage,
        interests: normalizeTopics(data.interests),
        placementSource: "manual",
        placementConfidence: 0.42,
        subskillProfile: {
          vocabulary: data.currentLevel === "A1" ? 0.35 : 0.55,
          grammar: data.currentLevel === "A1" ? 0.3 : 0.5,
          reading: data.currentLevel === "A1" ? 0.3 : 0.5,
          listening: 0.2,
          writing: data.currentLevel === "A1" ? 0.2 : 0.4,
          updatedAt: new Date(),
        },
        learnerStage,
        scriptStage,
        preferredContentStyle: data.preferredContentStyle ?? "balanced",
        currentRoadmapNodeId: node ? String(node._id) : undefined,
        onboardingVersion: "learning_v1",
        onboardingDone: true,
      },
    },
    { new: true }
  );

  if (node) {
    await UserRoadmapProgress.findOneAndUpdate(
      { userId: id, nodeId: String(node._id) },
      {
        $setOnInsert: {
          userId: id,
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
  }

  const normalized = await normalizePersistedUser(user);
  return normalized.toJSON() as unknown as IUser;
}

function getManualLearnerStage(level: CefrLevel): LearnerStage {
  if (level === "A1") return "absolute_beginner";
  if (level === "A2") return "late_beginner";
  if (level === "B1") return "intermediate";
  if (level === "B2") return "upper_intermediate";
  return "advanced";
}

function getManualScriptStage(language: string, level: CefrLevel): ScriptStage {
  if (language !== "ja") return ["zh", "ko"].includes(language) ? "native_script" : "latin";
  if (level === "A1") return "romaji";
  if (level === "A2") return "kana_supported";
  if (level === "B1") return "kanji_intro";
  if (level === "B2") return "kanji_supported";
  return "kanji_confident";
}

export async function getUserStats(userId: string): Promise<{
  learnedCount: number;
  savedCount: number;
  difficultCount: number;
  sessionCount: number;
  weeklyLearned: number;
  recentSessions: unknown[];
}> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [learnedCount, savedCount, difficultCount, sessionCount, recentSessions, weeklyLearned] =
    await Promise.all([
      UserWord.countDocuments({ userId, status: "LEARNED" }),
      UserWord.countDocuments({ userId, status: "SAVED" }),
      UserWord.countDocuments({ userId, status: "DIFFICULT" }),
      LearningSession.countDocuments({ userId }),
      LearningSession.find({ userId })
        .sort({ startedAt: -1 })
        .limit(7)
        .select("startedAt wordsReviewed score sessionType")
        .lean({ virtuals: true }),
      UserWord.countDocuments({
        userId,
        status: "LEARNED",
        learnedAt: { $gte: weekAgo },
      }),
    ]);

  return {
    learnedCount,
    savedCount,
    difficultCount,
    sessionCount,
    weeklyLearned,
    recentSessions,
  };
}

export async function deleteUser(id: string): Promise<void> {
  await Promise.all([
    UserWord.deleteMany({ userId: id }),
    LearningSession.deleteMany({ userId: id }),
  ]);
  await User.findByIdAndDelete(id);
}
