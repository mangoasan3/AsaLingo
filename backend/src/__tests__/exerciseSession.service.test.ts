import { ExerciseSession } from "../models";
import { verifySubmittedResults } from "../modules/learning/exerciseSession.service";
import { evaluateQuizAnswer } from "../modules/ai/ai.service";

jest.mock("../models", () => ({
  ExerciseSession: {
    findOne: jest.fn(),
  },
  User: {
    findById: jest.fn(),
  },
}));

jest.mock("../modules/ai/ai.service", () => ({
  evaluateQuizAnswer: jest.fn(),
  toPublicQuizQuestion: jest.fn((question) => question),
}));

const mockedExerciseSession = jest.mocked(ExerciseSession);
const mockedEvaluateQuizAnswer = jest.mocked(evaluateQuizAnswer);

describe("verifySubmittedResults", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uses the canonical server-side question instead of client-submitted correctness", async () => {
    mockedExerciseSession.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        exercises: [
          {
            questionHash: "hash-1",
            wordId: "word-1",
            type: "multiple_choice",
            correctAnswer: "dog",
            exerciseMeta: { templateFamily: "mc_core" },
          },
        ],
      }),
    } as never);
    mockedEvaluateQuizAnswer.mockResolvedValue({
      questionType: "multiple_choice",
      status: "correct",
      correct: true,
      feedback: "Nice work.",
    });

    const verified = await verifySubmittedResults({
      user: {
        _id: "user-1",
        currentLevel: "A1",
        studyLanguage: "en",
        nativeLanguage: "ru",
      } as never,
      exerciseSessionId: "session-1",
      submittedResults: [
        {
          questionHash: "hash-1",
          answer: "dog",
          correct: false,
        },
      ],
    });

    expect(mockedEvaluateQuizAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: "dog",
        question: expect.objectContaining({
          questionHash: "hash-1",
          correctAnswer: "dog",
        }),
      })
    );
    expect(verified.correctCount).toBe(1);
    expect(verified.results[0]).toMatchObject({
      correct: true,
      evaluationStatus: "correct",
      templateFamily: "mc_core",
    });
  });
});
