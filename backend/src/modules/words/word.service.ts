import { VocabularyWord, UserWord, User } from "../../models";
import type { IVocabularyWord, IUser, CefrLevel, WordStatus } from "../../models";
import { AppError } from "../../middleware/errorHandler";
import { generateAndSaveWords } from "../ai/ai.service";
import { normalizeLanguageCode, normalizeTopic } from "../../utils/language";

const LEVEL_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const AI_SOURCE_FILTER = { sourceType: { $in: ["ai-generated", "seed"] } };

function normalizeWord<T extends Record<string, unknown>>(word: T): T & { id: string } {
  return {
    ...word,
    id: String(word.id ?? word._id ?? ""),
  };
}

function asVocabularyWord(word: Record<string, unknown>): IVocabularyWord {
  return normalizeWord(word) as unknown as IVocabularyWord;
}

function getUserPair(user: Pick<IUser, "studyLanguage" | "nativeLanguage">) {
  return {
    targetLanguage: normalizeLanguageCode(user.studyLanguage, "en"),
    nativeLanguage: normalizeLanguageCode(user.nativeLanguage, "ru"),
  };
}

async function ensureCatalogWords(params: {
  targetLanguage: string;
  nativeLanguage: string;
  level: CefrLevel;
  topic?: string;
  count?: number;
}): Promise<void> {
  await generateAndSaveWords({
    level: params.level,
    targetLanguage: params.targetLanguage,
    nativeLanguage: params.nativeLanguage,
    topic: params.topic,
    count: params.count ?? 18,
  });
}

export async function getWords(
  user: Pick<IUser, "studyLanguage" | "nativeLanguage" | "currentLevel">,
  filters: {
    level?: CefrLevel;
    topic?: string;
    language?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ words: IVocabularyWord[]; total: number; page: number; limit: number; pages: number }> {
  const { targetLanguage, nativeLanguage } = getUserPair(user);
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const level = filters.level ?? user.currentLevel;
  const topic = filters.topic ? normalizeTopic(filters.topic) : undefined;

  const query: Record<string, unknown> = {
    ...AI_SOURCE_FILTER,
    language: normalizeLanguageCode(filters.language || targetLanguage, targetLanguage as never),
    nativeLanguage,
    cefrLevel: level,
  };

  if (topic) query.topic = topic;

  let [words, total] = await Promise.all([
    VocabularyWord.find(query)
      .sort({ progressionStep: 1, createdAt: 1, word: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ virtuals: true }) as Promise<unknown>,
    VocabularyWord.countDocuments(query),
  ]);

  if (total === 0) {
    try {
      await ensureCatalogWords({
        targetLanguage,
        nativeLanguage,
        level,
        topic,
        count: Math.max(limit, 18),
      });
      [words, total] = await Promise.all([
        VocabularyWord.find(query)
          .sort({ progressionStep: 1, createdAt: 1, word: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean({ virtuals: true }) as Promise<unknown>,
        VocabularyWord.countDocuments(query),
      ]);
    } catch {
      // Surface an empty state instead of falling back to seeded data.
    }
  }

  return {
    words: (words as Record<string, unknown>[]).map((word) => asVocabularyWord(word)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getWordByIdForUser(
  user: Pick<IUser, "studyLanguage" | "nativeLanguage">,
  id: string
): Promise<IVocabularyWord> {
  const { targetLanguage, nativeLanguage } = getUserPair(user);

  const word = await VocabularyWord.findOne({
    _id: id,
    ...AI_SOURCE_FILTER,
    language: targetLanguage,
    nativeLanguage,
  }).lean({ virtuals: true }) as unknown as IVocabularyWord | null;

  if (!word) throw new AppError("Word not found for your selected language pair", 404);
  return asVocabularyWord(word as unknown as Record<string, unknown>);
}

export async function searchWords(
  user: Pick<IUser, "studyLanguage" | "nativeLanguage">,
  query: string,
  language?: string
): Promise<IVocabularyWord[]> {
  const { targetLanguage, nativeLanguage } = getUserPair(user);
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const words = await VocabularyWord.find({
    ...AI_SOURCE_FILTER,
    language: normalizeLanguageCode(language || targetLanguage, targetLanguage as never),
    nativeLanguage,
    $or: [
      { word: { $regex: normalizedQuery, $options: "i" } },
      { definition: { $regex: normalizedQuery, $options: "i" } },
      { translation: { $regex: normalizedQuery, $options: "i" } },
      { easierExplanation: { $regex: normalizedQuery, $options: "i" } },
    ],
  })
    .sort({ progressionStep: 1, createdAt: -1 })
    .limit(20)
    .lean({ virtuals: true }) as unknown as IVocabularyWord[];

  return words.map((word) => asVocabularyWord(word as unknown as Record<string, unknown>));
}

export async function getRecommendedWords(userId: string, limit = 10): Promise<IVocabularyWord[]> {
  const user = await User.findById(userId).lean({ virtuals: true }) as unknown as IUser | null;
  if (!user) throw new AppError("User not found", 404);

  const { targetLanguage, nativeLanguage } = getUserPair(user);
  const userLevel = user.currentLevel;
  const levelIdx = LEVEL_ORDER.indexOf(userLevel);
  const levels = [
    userLevel,
    levelIdx > 0 ? LEVEL_ORDER[levelIdx - 1] : null,
    levelIdx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[levelIdx + 1] : null,
  ].filter(Boolean) as CefrLevel[];

  const userWordDocs = await UserWord.find({ userId }).select("wordId").lean();
  const knownIds = userWordDocs.map((uw) => uw.wordId as string);
  const interests = (user.interests ?? []).map((interest) => normalizeTopic(interest));

  let words = await VocabularyWord.find({
    ...AI_SOURCE_FILTER,
    language: targetLanguage,
    nativeLanguage,
    cefrLevel: { $in: levels },
    _id: { $nin: knownIds },
    ...(interests.length > 0 ? { topic: { $in: interests } } : {}),
  })
    .sort({ progressionStep: 1, createdAt: 1 })
    .limit(limit)
    .lean({ virtuals: true }) as unknown as IVocabularyWord[];

  if (words.length < limit) {
    try {
      await ensureCatalogWords({
        targetLanguage,
        nativeLanguage,
        level: userLevel,
        topic: interests[0],
        count: 20,
      });
      words = await VocabularyWord.find({
        ...AI_SOURCE_FILTER,
        language: targetLanguage,
        nativeLanguage,
        cefrLevel: { $in: levels },
        _id: { $nin: knownIds },
      })
        .sort({ progressionStep: 1, createdAt: 1 })
        .limit(limit)
        .lean({ virtuals: true }) as unknown as IVocabularyWord[];
    } catch {
      // Keep any existing words.
    }
  }

  return words.map((word) => asVocabularyWord(word as unknown as Record<string, unknown>));
}

export async function getUserWords(userId: string, status?: WordStatus): Promise<unknown[]> {
  const query: Record<string, unknown> = { userId };
  if (status) query.status = status;

  const userWords = await UserWord.find(query)
    .sort({ updatedAt: -1 })
    .populate({
      path: "wordId",
      match: AI_SOURCE_FILTER,
    })
    .lean({ virtuals: true });

  return userWords
    .filter((uw) => typeof uw.wordId === "object" && uw.wordId !== null)
    .map((uw) => ({
      ...uw,
      word: normalizeWord(uw.wordId as unknown as Record<string, unknown>),
      wordId: (uw.wordId as unknown as Record<string, unknown>)._id,
    }));
}

export async function saveWord(userId: string, wordId: string) {
  const word = await VocabularyWord.findOne({ _id: wordId, ...AI_SOURCE_FILTER }).lean({ virtuals: true });
  if (!word) throw new AppError("Word not found", 404);

  const userWord = await UserWord.findOneAndUpdate(
    { userId, wordId },
    {
      $set: {
        status: "SAVED",
        savedAt: new Date(),
        masteryState: "introduced",
      },
    },
    { upsert: true, new: true }
  ).populate("wordId");

  const obj = userWord.toJSON() as Record<string, unknown>;
  return { ...obj, word: obj.wordId };
}

export async function markLearned(userId: string, wordId: string) {
  const userWord = await UserWord.findOneAndUpdate(
    { userId, wordId },
    {
      $set: {
        status: "LEARNED",
        learnedAt: new Date(),
        lastPracticedAt: new Date(),
        masteryState: "mastered",
      },
      $inc: { timesReviewed: 1 },
    },
    { upsert: true, new: true }
  ).populate("wordId");

  const obj = userWord.toJSON() as Record<string, unknown>;
  return { ...obj, word: obj.wordId };
}

export async function markDifficult(userId: string, wordId: string) {
  const userWord = await UserWord.findOneAndUpdate(
    { userId, wordId },
    {
      $set: {
        status: "DIFFICULT",
        lastPracticedAt: new Date(),
        masteryState: "practicing",
      },
    },
    { upsert: true, new: true }
  ).populate("wordId");

  const obj = userWord.toJSON() as Record<string, unknown>;
  return { ...obj, word: obj.wordId };
}

export async function updateWordStatus(userId: string, wordId: string, status: WordStatus) {
  const existing = await UserWord.findOne({ userId, wordId });
  if (!existing) throw new AppError("Word not in your list", 404);

  const updates: Record<string, unknown> = {
    status,
    lastPracticedAt: new Date(),
  };

  if (status === "LEARNED") {
    updates.learnedAt = new Date();
    updates.masteryState = "mastered";
  } else if (status === "LEARNING") {
    updates.masteryState = "practicing";
  } else if (status === "SAVED") {
    updates.masteryState = "introduced";
  } else if (status === "DIFFICULT") {
    updates.masteryState = "practicing";
  }

  const userWord = await UserWord.findOneAndUpdate(
    { userId, wordId },
    { $set: updates },
    { new: true }
  ).populate("wordId");

  const obj = userWord!.toJSON() as Record<string, unknown>;
  return { ...obj, word: obj.wordId };
}

export async function removeWord(userId: string, wordId: string): Promise<void> {
  const existing = await UserWord.findOne({ userId, wordId });
  if (!existing) throw new AppError("Word not in your list", 404);

  await UserWord.deleteOne({ userId, wordId });
}
