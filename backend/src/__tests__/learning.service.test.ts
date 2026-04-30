import { CurriculumNode, User, UserRoadmapProgress, UserWord } from "../models";
import { setCurrentRoadmapNode } from "../modules/learning/learning.service";
import { buildLearningContext } from "../modules/learning/learningContext.service";
import { seedLearningFoundation } from "../seeds/learningSeed";

jest.mock("../models", () => ({
  CurriculumNode: {
    findById: jest.fn(),
    find: jest.fn(),
  },
  LearningSession: {},
  MediaTask: {},
  User: {
    findById: jest.fn(),
  },
  UserRoadmapProgress: {
    find: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  UserWord: {
    countDocuments: jest.fn(),
  },
  VocabularyWord: {},
}));

jest.mock("../modules/learning/learningContext.service", () => ({
  buildLearningContext: jest.fn(),
}));

jest.mock("../seeds/learningSeed", () => ({
  ensureWordsForNode: jest.fn(),
  seedLearningFoundation: jest.fn(),
}));

const mockedCurriculumNode = jest.mocked(CurriculumNode);
const mockedUser = jest.mocked(User);
const mockedRoadmapProgress = jest.mocked(UserRoadmapProgress);
const mockedUserWord = jest.mocked(UserWord);
const mockedBuildLearningContext = jest.mocked(buildLearningContext);
const mockedSeedLearningFoundation = jest.mocked(seedLearningFoundation);

function createLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

function createSortedLeanQuery<T>(value: T) {
  return {
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  };
}

describe("setCurrentRoadmapNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSeedLearningFoundation.mockResolvedValue({
      curriculumCount: 0,
      mediaCount: 0,
      removedMediaCount: 0,
      wordCount: 0,
    });
    mockedBuildLearningContext.mockResolvedValue({
      level: "A1",
      learnerStage: "absolute_beginner",
      scriptStage: "latin",
      placementSource: "manual",
      placementConfidence: 0.8,
      interests: [],
      learningGoal: "travel",
      skillWeaknesses: [],
      currentRoadmapNode: { _id: "node-1" } as never,
      currentProgress: { status: "in_progress", progressPercent: 0, attempts: 0 },
      promptContext: "ctx",
    } as never);
    mockedUserWord.countDocuments.mockResolvedValue(0);
  });

  test("user can switch to an available node", async () => {
    const userDoc = {
      _id: "user-1",
      studyLanguage: "en",
      currentRoadmapNodeId: "node-0",
      save: jest.fn().mockResolvedValue(undefined),
    };
    const node = {
      _id: "node-1",
      language: "en",
      isActive: true,
      stageOrder: 1,
      unit: 1,
      lesson: 1,
      stage: "Foundations",
      progress: { status: "available", progressPercent: 0, attempts: 0 },
      unlockCriteria: { previousNodeIds: [] },
    };

    mockedUser.findById.mockResolvedValue(userDoc);
    mockedCurriculumNode.findById.mockResolvedValue(node);
    mockedCurriculumNode.find.mockReturnValue(
      createSortedLeanQuery([node]) as unknown as ReturnType<typeof mockedCurriculumNode.find>
    );
    mockedRoadmapProgress.find.mockReturnValue(
      createLeanQuery([
        { nodeId: "node-1", status: "available", progressPercent: 0, attempts: 0 },
      ]) as unknown as ReturnType<typeof mockedRoadmapProgress.find>
    );

    const result = await setCurrentRoadmapNode("user-1", "node-1");

    expect(userDoc.currentRoadmapNodeId).toBe("node-1");
    expect(userDoc.save).toHaveBeenCalled();
    expect(mockedRoadmapProgress.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-1", nodeId: "node-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "in_progress" }),
      }),
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    expect(result).toMatchObject({
      continueLearning: { _id: "node-1" },
      roadmapProgressPercent: 0,
    });
  });

  test("user cannot switch to a locked node", async () => {
    const userDoc = {
      _id: "user-1",
      studyLanguage: "en",
      currentRoadmapNodeId: "node-0",
      save: jest.fn().mockResolvedValue(undefined),
    };
    const node = {
      _id: "node-2",
      language: "en",
      isActive: true,
      stageOrder: 2,
      unit: 1,
      lesson: 2,
      stage: "Foundations",
      unlockCriteria: { previousNodeIds: ["node-1"] },
    };

    mockedUser.findById.mockResolvedValue(userDoc);
    mockedCurriculumNode.findById.mockResolvedValue(node);
    mockedCurriculumNode.find.mockReturnValue(
      createSortedLeanQuery([node]) as unknown as ReturnType<typeof mockedCurriculumNode.find>
    );
    mockedRoadmapProgress.find.mockReturnValue(
      createLeanQuery([
        { nodeId: "node-2", status: "locked", progressPercent: 0, attempts: 0 },
      ]) as unknown as ReturnType<typeof mockedRoadmapProgress.find>
    );

    await expect(setCurrentRoadmapNode("user-1", "node-2")).rejects.toMatchObject({
      message: "This roadmap node is still locked. Complete earlier lessons to unlock it",
      statusCode: 403,
    });
    expect(userDoc.save).not.toHaveBeenCalled();
    expect(mockedRoadmapProgress.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("user cannot switch to a node from another language", async () => {
    const userDoc = {
      _id: "user-1",
      studyLanguage: "en",
      currentRoadmapNodeId: "node-0",
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockedUser.findById.mockResolvedValue(userDoc);
    mockedCurriculumNode.findById.mockResolvedValue({
      _id: "node-es-1",
      language: "es",
      isActive: true,
    });

    await expect(setCurrentRoadmapNode("user-1", "node-es-1")).rejects.toMatchObject({
      message: "You can only switch to roadmap nodes in your current study language",
      statusCode: 400,
    });
    expect(mockedCurriculumNode.find).not.toHaveBeenCalled();
    expect(mockedRoadmapProgress.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
