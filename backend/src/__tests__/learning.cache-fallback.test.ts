import { CurriculumNode, LearningSession, MediaTask, User, UserRoadmapProgress, UserWord, VocabularyWord } from "../models";
import { generateRoadmapExercises } from "../modules/ai/ai.service";
import { getCachedExerciseSession } from "../modules/learning/exerciseSession.service";
import { getContinueLesson } from "../modules/learning/learning.service";

jest.mock("../models", () => ({
  CurriculumNode: {
    findById: jest.fn(),
  },
  ExerciseSession: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  LearningSession: {
    find: jest.fn(),
  },
  MediaTask: {
    findOne: jest.fn(),
  },
  User: {
    findById: jest.fn(),
  },
  UserRoadmapProgress: {
    findOneAndUpdate: jest.fn(),
  },
  UserWord: {
    findOneAndUpdate: jest.fn(),
  },
  VocabularyWord: {
    find: jest.fn(),
    updateMany: jest.fn(),
  },
}));

jest.mock("../modules/ai/ai.service", () => ({
  generateAndSaveWords: jest.fn(),
  generateRoadmapExercises: jest.fn(),
}));

jest.mock("../modules/learning/exerciseSession.service", () => ({
  createExerciseSession: jest.fn(),
  getCachedExerciseSession: jest.fn(),
  verifySubmittedResults: jest.fn(),
}));

jest.mock("../seeds/learningSeed", () => ({
  ensureWordsForNode: jest.fn(),
  seedLearningFoundation: jest.fn(),
}));

const mockedUser = jest.mocked(User);
const mockedCurriculumNode = jest.mocked(CurriculumNode);
const mockedLearningSession = jest.mocked(LearningSession);
const mockedMediaTask = jest.mocked(MediaTask);
const mockedVocabularyWord = jest.mocked(VocabularyWord);
const mockedGenerateRoadmapExercises = jest.mocked(generateRoadmapExercises);
const mockedGetCachedExerciseSession = jest.mocked(getCachedExerciseSession);

function createSortedLimitLeanQuery<T>(value: T) {
  return {
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(value),
      }),
    }),
  };
}

describe("getContinueLesson", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUser.findById.mockResolvedValue({
      _id: "user-1",
      studyLanguage: "en",
      nativeLanguage: "ru",
      currentLevel: "A1",
      learnerStage: "absolute_beginner",
      scriptStage: "latin",
      interests: ["travel"],
      currentRoadmapNodeId: "node-1",
      save: jest.fn().mockResolvedValue(undefined),
    } as never);
    mockedCurriculumNode.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "node-1",
        language: "en",
        level: "A1",
        learnerStage: "absolute_beginner",
        stageOrder: 1,
        unit: 1,
        lesson: 1,
        title: "Introductions",
        skillFocus: ["vocabulary"],
        exerciseMix: [{ type: "multiple_choice", weight: 1 }],
        interestTags: ["travel"],
        recommendedVocabulary: [],
        grammarTargets: [],
      }),
    } as never);
    mockedVocabularyWord.find.mockReturnValue(
      createSortedLimitLeanQuery(
        Array.from({ length: 12 }, (_, index) => ({
          _id: `word-${index + 1}`,
          id: `word-${index + 1}`,
          word: `word-${index + 1}`,
          translation: `translation-${index + 1}`,
          definition: `definition-${index + 1}`,
          exampleSentence: `example-${index + 1}`,
          language: "en",
          nativeLanguage: "ru",
          cefrLevel: "A1",
        }))
      ) as never
    );
    mockedLearningSession.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as never);
    mockedMediaTask.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    } as never);
  });

  test("returns a recent cached lesson when exercise generation fails", async () => {
    mockedGenerateRoadmapExercises.mockRejectedValue(new Error("AI down"));
    mockedGetCachedExerciseSession.mockResolvedValue({
      exerciseSessionId: "cached-session",
      node: { _id: "node-1", title: "Introductions" },
      focusWords: [{ id: "word-1", word: "hello" }],
      phase: "introduction_recognition_controlled_production_review",
      scriptSupport: { language: "en", scriptStage: "latin" },
      exercises: [],
    } as never);

    const lesson = await getContinueLesson("user-1");

    expect(lesson).toMatchObject({
      exerciseSessionId: "cached-session",
      phase: "introduction_recognition_controlled_production_review",
    });
    expect(mockedGetCachedExerciseSession).toHaveBeenCalled();
  });
});
