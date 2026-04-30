import { PlacementItem, PlacementSession } from "../models";
import { generatePlacementItemWithAi } from "../modules/ai/ai.service";
import { getNextPlacementItem } from "../modules/placement/placement.service";

jest.mock("../models", () => ({
  CurriculumNode: {
    findOne: jest.fn(),
  },
  PlacementItem: {
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  PlacementSession: {
    findOne: jest.fn(),
  },
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  UserRoadmapProgress: {
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock("../modules/ai/ai.service", () => ({
  generatePlacementItemWithAi: jest.fn(),
}));

jest.mock("../seeds/learningSeed", () => ({
  seedLearningFoundation: jest.fn(),
}));

const mockedPlacementSession = jest.mocked(PlacementSession);
const mockedPlacementItem = jest.mocked(PlacementItem);
const mockedGeneratePlacementItemWithAi = jest.mocked(generatePlacementItemWithAi);

function createLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe("getNextPlacementItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("reuses cached placement items before attempting fresh AI generation", async () => {
    const sessionDoc = {
      _id: "session-1",
      userId: "user-1",
      status: "active",
      language: "en",
      nativeLanguage: "ru",
      seed: "seed-1",
      answeredCount: 0,
      targetItemCount: 8,
      currentDifficulty: 2,
      askedItems: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedPlacementSession.findOne.mockResolvedValue(sessionDoc as never);
    mockedPlacementItem.find
      .mockReturnValueOnce(createLeanQuery([
        {
          _id: "item-1",
          itemKey: "ai:item-1",
          type: "multiple_choice",
          skill: "vocabulary",
          difficulty: 2,
          cefrLevel: "A1",
          prompt: "Choose the best answer",
          choices: ["dog", "cat", "bird", "fish"],
          correctAnswer: "dog",
          acceptedAnswers: ["dog"],
          itemFamily: "family-1",
          variants: [],
        },
      ]) as never);

    const result = await getNextPlacementItem("user-1", "session-1");

    expect(result).toMatchObject({
      complete: false,
      item: {
        itemId: "item-1",
        itemKey: "ai:item-1",
      },
    });
    expect(mockedGeneratePlacementItemWithAi).not.toHaveBeenCalled();
    expect(sessionDoc.save).toHaveBeenCalled();
  });
});
