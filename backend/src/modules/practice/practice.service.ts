import { User, UserWord, VocabularyWord, LearningSession } from "../../models";
import type { IUser, IVocabularyWord, PracticeType } from "../../models";
import { generateAndSaveWords } from "../ai/ai.service";
import { normalizeLanguageCode, normalizeTopic } from "../../utils/language";
import {
  type SubmittedExerciseAnswer,
  verifySubmittedResults,
} from "../learning/exerciseSession.service";

const AI_SOURCE_FILTER = { sourceType: { $in: ["ai-generated", "seed"] } };

function getUserPair(user: Pick<IUser, "studyLanguage" | "nativeLanguage">) {
  return {
    targetLanguage: normalizeLanguageCode(user.studyLanguage, "en"),
    nativeLanguage: normalizeLanguageCode(user.nativeLanguage, "ru"),
  };
}

export async function getDailyWords(userId: string) {
  const user = await User.findById(userId).lean({ virtuals: true }) as unknown as IUser | null;
  if (!user) throw new Error("User not found");

  const { targetLanguage, nativeLanguage } = getUserPair(user);

  const difficultWords = await UserWord.find({ userId, status: "DIFFICULT" })
    .populate({ path: "wordId", match: AI_SOURCE_FILTER })
    .limit(3)
    .lean({ virtuals: true });

  const learningWords = await UserWord.find({ userId, status: "LEARNING" })
    .populate({ path: "wordId", match: AI_SOURCE_FILTER })
    .sort({ nextReviewAt: 1, updatedAt: 1 })
    .limit(4)
    .lean({ virtuals: true });

  const userWordDocs = await UserWord.find({ userId }).select("wordId").lean();
  const allUserWordIds = userWordDocs.map((uw) => uw.wordId as string);

  const needed = 10 - (
    difficultWords.filter((item) => item.wordId).length +
    learningWords.filter((item) => item.wordId).length
  );

  let newWords: IVocabularyWord[] = [];
  if (needed > 0) {
    newWords = await VocabularyWord.find({
      ...AI_SOURCE_FILTER,
      language: targetLanguage,
      nativeLanguage,
      cefrLevel: user.currentLevel,
      _id: { $nin: allUserWordIds },
    })
      .sort({ progressionStep: 1, createdAt: 1 })
      .limit(needed)
      .lean({ virtuals: true }) as unknown as IVocabularyWord[];

    if (newWords.length < needed) {
      try {
        await generateAndSaveWords({
          level: user.currentLevel,
          targetLanguage,
          nativeLanguage,
          topic: normalizeTopic(user.interests?.[0]),
          count: 18,
        });
        newWords = await VocabularyWord.find({
          ...AI_SOURCE_FILTER,
          language: targetLanguage,
          nativeLanguage,
          cefrLevel: user.currentLevel,
          _id: { $nin: allUserWordIds },
        })
          .sort({ progressionStep: 1, createdAt: 1 })
          .limit(needed)
          .lean({ virtuals: true }) as unknown as IVocabularyWord[];
      } catch {
        // Keep partial results.
      }
    }
  }

  return {
    difficult: difficultWords
      .filter((uw) => typeof uw.wordId === "object" && uw.wordId !== null)
      .map((uw) => uw.wordId),
    learning: learningWords
      .filter((uw) => typeof uw.wordId === "object" && uw.wordId !== null)
      .map((uw) => uw.wordId),
    new: newWords,
  };
}

export async function submitPractice(
  userId: string,
  sessionType: PracticeType,
  results: SubmittedExerciseAnswer[],
  durationSecs?: number,
  metadata?: {
    exerciseSessionId?: string;
    roadmapNodeId?: string;
    learnerStage?: string;
    scriptStage?: string;
    exerciseTypes?: string[];
    templateFamilies?: string[];
  }
) {
  const user = await User.findById(userId).lean({ virtuals: true }) as unknown as IUser | null;
  if (!user) throw new Error("User not found");

  const { targetLanguage, nativeLanguage } = getUserPair(user);
  const verified = await verifySubmittedResults({
    user,
    exerciseSessionId: metadata?.exerciseSessionId,
    submittedResults: results,
  });

  const session = await LearningSession.create({
    userId,
    sessionType,
    targetLanguage,
    nativeLanguage,
    cefrLevel: user.currentLevel,
    topic: normalizeTopic(user.interests?.[0]),
    roadmapNodeId: metadata?.roadmapNodeId,
    learnerStage: metadata?.learnerStage ?? user.learnerStage,
    scriptStage: metadata?.scriptStage ?? user.scriptStage,
    wordsReviewed: verified.total,
    correctCount: verified.correctCount,
    evaluatedCount: verified.evaluatedCount,
    pendingReviewCount: verified.pendingReviewCount,
    score: verified.score,
    endedAt: new Date(),
    durationSecs,
    wordsAsked: [
      ...new Set(verified.results.map((result) => result.wordId).filter(isPersistableWordId)),
    ],
    questionHashes: [
      ...new Set(verified.results.map((result) => result.questionHash).filter(Boolean) as string[]),
    ],
    exerciseTypes:
      metadata?.exerciseTypes ??
      verified.exerciseTypes,
    templateFamilies:
      metadata?.templateFamilies ??
      verified.templateFamilies,
    answerRecords: verified.results,
  });

  for (const result of verified.results) {
    if (!result.countedInScore) continue;
    if (!isPersistableWordId(result.wordId)) continue;
    const existing = await UserWord.findOne({ userId, wordId: result.wordId });

    if (existing) {
      const newCorrect = existing.correctCount + (result.correct ? 1 : 0);
      const newReviewed = existing.timesReviewed + 1;
      const accuracy = newCorrect / newReviewed;

      let newStatus = existing.status;
      let masteryState = existing.masteryState;

      if (accuracy >= 0.8 && newReviewed >= 3 && existing.status !== "LEARNED") {
        newStatus = "LEARNED";
        masteryState = "mastered";
      } else if (accuracy < 0.4 && newReviewed >= 2) {
        newStatus = "DIFFICULT";
        masteryState = "practicing";
      } else if (existing.status === "NEW" || existing.status === "SAVED") {
        newStatus = "LEARNING";
        masteryState = "practicing";
      } else if (accuracy >= 0.6) {
        masteryState = "reviewing";
      }

      const updateData: Record<string, unknown> = {
        timesReviewed: newReviewed,
        correctCount: newCorrect,
        status: newStatus,
        masteryState,
        lastPracticedAt: new Date(),
        lastSeenRoadmapNodeId: metadata?.roadmapNodeId,
        progressionStep: Math.min((existing.progressionStep ?? 1) + (result.correct ? 1 : 0), 10),
        nextReviewAt: new Date(Date.now() + getReviewInterval(newReviewed, accuracy)),
      };

      if (newStatus === "LEARNED" && !existing.learnedAt) {
        updateData.learnedAt = new Date();
      }

      await UserWord.findOneAndUpdate(
        { userId, wordId: result.wordId },
        {
          $set: updateData,
          $addToSet: {
            ...(metadata?.roadmapNodeId ? { roadmapNodeIds: metadata.roadmapNodeId } : {}),
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
        firstSeenRoadmapNodeId: metadata?.roadmapNodeId,
        lastSeenRoadmapNodeId: metadata?.roadmapNodeId,
        roadmapNodeIds: metadata?.roadmapNodeId ? [metadata.roadmapNodeId] : [],
        masteryState: result.correct ? "practicing" : "introduced",
        progressionStep: result.correct ? 2 : 1,
        exposureCount: 1,
        templateFamiliesSeen: result.templateFamily ? [result.templateFamily] : [],
      });
    }
  }

  await updateStreak(userId);

  return {
    session,
    score: verified.score,
    correctCount: verified.correctCount,
    evaluatedCount: verified.evaluatedCount,
    pendingReviewCount: verified.pendingReviewCount,
    totalWords: verified.total,
  };
}

function isPersistableWordId(wordId: string): boolean {
  return !wordId.startsWith("media:") && !wordId.startsWith("lesson:");
}

function getReviewInterval(timesReviewed: number, accuracy: number): number {
  if (accuracy < 0.5) return 1 * 24 * 60 * 60 * 1000;
  const baseIntervals = [1, 3, 7, 14, 30, 60];
  const idx = Math.min(timesReviewed - 1, baseIntervals.length - 1);
  return baseIntervals[idx] * 24 * 60 * 60 * 1000;
}

async function updateStreak(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const now = new Date();
  const lastStudied = user.lastStudiedAt;

  let streak = user.streak;
  if (!lastStudied) {
    streak = 1;
  } else {
    const daysDiff = Math.floor(
      (now.getTime() - lastStudied.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      // Same day, no change.
    } else if (daysDiff === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
  }

  await User.findByIdAndUpdate(userId, { $set: { streak, lastStudiedAt: now } });
}
