import { CurriculumNode, LearningSession, User, UserRoadmapProgress, UserWord } from "../models";
import { submitLearningResults } from "../modules/learning/learning.service";
import { verifySubmittedResults } from "../modules/learning/exerciseSession.service";

jest.mock("../models", () => ({
  CurriculumNode: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
  ExerciseSession: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  LearningSession: {
    create: jest.fn(),
  },
  MediaTask: {
    findOne: jest.fn(),
  },
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  UserRoadmapProgress: {
    findOneAndUpdate: jest.fn(),
  },
  UserWord: {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  VocabularyWord: {
    find: jest.fn(),
  },
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
const mockedLearningSession = jest.mocked(LearningSession);
const mockedUserWord = jest.mocked(UserWord);
const mockedRoadmapProgress = jest.mocked(UserRoadmapProgress);
const mockedCurriculumNode = jest.mocked(CurriculumNode);
const mockedVerifySubmittedResults = jest.mocked(verifySubmittedResults);

describe("submitLearningResults", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUser.findById.mockResolvedValue({
      _id: "user-1",
      currentLevel: "A1",
      studyLanguage: "en",
      nativeLanguage: "ru",
      interests: ["travel"],
      learnerStage: "absolute_beginner",
      scriptStage: "latin",
      streak: 3,
      lastStudiedAt: new Date("2026-04-23T00:00:00.000Z"),
      currentRoadmapNodeId: "node-1",
    } as never);
    mockedLearningSession.create.mockResolvedValue({ _id: "session-1" } as never);
    mockedCurriculumNode.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: "node-1", stageOrder: 1 }),
    } as never);
    mockedCurriculumNode.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    } as never);
    mockedUserWord.findOne.mockResolvedValue(null as never);
  });

  test("does not reduce mastery and still allows completion for pending-review answers", async () => {
    mockedVerifySubmittedResults.mockResolvedValue({
      results: [
        {
          wordId: "word-1",
          correct: false,
          evaluationStatus: "pending_review",
          countedInScore: false,
          questionHash: "hash-1",
          questionType: "sentence_writing",
          answer: "A saved answer",
          templateFamily: "writing",
        },
      ],
      total: 1,
      correctCount: 0,
      evaluatedCount: 0,
      pendingReviewCount: 1,
      score: 0,
      progressRatio: 1,
      exerciseTypes: ["sentence_writing"],
      templateFamilies: ["writing"],
    });

    await submitLearningResults("user-1", {
      exerciseSessionId: "exercise-session-1",
      roadmapNodeId: "node-1",
      results: [{ questionHash: "hash-1", answer: "A saved answer" }],
    });

    expect(mockedUserWord.findOne).not.toHaveBeenCalled();
    expect(mockedUserWord.create).not.toHaveBeenCalled();
    expect(mockedLearningSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        correctCount: 0,
        evaluatedCount: 0,
        pendingReviewCount: 1,
        score: 0,
      })
    );
    expect(mockedRoadmapProgress.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-1", nodeId: "node-1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "completed",
          progressPercent: 100,
          lastScore: 0,
        }),
      }),
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  });

  test("calculates score only from evaluated answers", async () => {
    mockedVerifySubmittedResults.mockResolvedValue({
      results: [
        {
          wordId: "word-1",
          correct: true,
          evaluationStatus: "correct",
          countedInScore: true,
          questionHash: "hash-1",
          questionType: "multiple_choice",
          answer: "dog",
          templateFamily: "mc",
        },
        {
          wordId: "word-2",
          correct: false,
          evaluationStatus: "pending_review",
          countedInScore: false,
          questionHash: "hash-2",
          questionType: "sentence_writing",
          answer: "A saved answer",
          templateFamily: "writing",
        },
      ],
      total: 2,
      correctCount: 1,
      evaluatedCount: 1,
      pendingReviewCount: 1,
      score: 1,
      progressRatio: 1,
      exerciseTypes: ["multiple_choice", "sentence_writing"],
      templateFamilies: ["mc", "writing"],
    });

    await submitLearningResults("user-1", {
      exerciseSessionId: "exercise-session-1",
      roadmapNodeId: "node-1",
      results: [
        { questionHash: "hash-1", answer: "dog" },
        { questionHash: "hash-2", answer: "A saved answer" },
      ],
    });

    expect(mockedLearningSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        correctCount: 1,
        evaluatedCount: 1,
        pendingReviewCount: 1,
        score: 1,
      })
    );
    expect(mockedUserWord.findOne).toHaveBeenCalledTimes(1);
  });
});
