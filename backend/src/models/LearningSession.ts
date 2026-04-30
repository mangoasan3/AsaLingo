import mongoose, { Schema, Document, Model } from "mongoose";
import type { QuizEvaluationStatus } from "../modules/ai/quiz.types";

export type PracticeType =
  | "MULTIPLE_CHOICE"
  | "FILL_BLANK"
  | "MATCH"
  | "SENTENCE_CONTEXT"
  | "DAILY_REVIEW"
  | "MIXED"
  | "GUIDED_LESSON"
  | "ROADMAP_REVIEW"
  | "PLACEMENT"
  | "MEDIA";

export interface ILearningSession extends Document<string> {
  _id: string;
  userId: string;
  sessionType: PracticeType;
  targetLanguage: string;
  nativeLanguage: string;
  cefrLevel?: string;
  topic?: string;
  roadmapNodeId?: string;
  learnerStage?: string;
  scriptStage?: string;
  wordsReviewed: number;
  correctCount: number;
  evaluatedCount: number;
  pendingReviewCount: number;
  score?: number;
  startedAt: Date;
  endedAt?: Date;
  durationSecs?: number;
  wordsAsked: string[];
  questionHashes: string[];
  exerciseTypes: string[];
  templateFamilies: string[];
  answerRecords: Array<{
    questionHash?: string;
    wordId: string;
    questionType?: string;
    answer?: string;
    templateFamily?: string;
    evaluationStatus: QuizEvaluationStatus;
    countedInScore: boolean;
    correct: boolean;
  }>;
  createdAt: Date;
}

const LearningSessionSchema = new Schema<ILearningSession>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    sessionType: {
      type: String,
      enum: [
        "MULTIPLE_CHOICE",
        "FILL_BLANK",
        "MATCH",
        "SENTENCE_CONTEXT",
        "DAILY_REVIEW",
        "MIXED",
        "GUIDED_LESSON",
        "ROADMAP_REVIEW",
        "PLACEMENT",
        "MEDIA",
      ],
      required: true,
    },
    targetLanguage: { type: String, required: true, index: true },
    nativeLanguage: { type: String, required: true, index: true },
    cefrLevel: { type: String },
    topic: { type: String },
    roadmapNodeId: { type: String, ref: "CurriculumNode", index: true },
    learnerStage: { type: String },
    scriptStage: { type: String },
    wordsReviewed: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    evaluatedCount: { type: Number, default: 0 },
    pendingReviewCount: { type: Number, default: 0 },
    score: { type: Number },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    durationSecs: { type: Number },
    wordsAsked: { type: [String], default: [] },
    questionHashes: { type: [String], default: [] },
    exerciseTypes: { type: [String], default: [] },
    templateFamilies: { type: [String], default: [] },
    answerRecords: {
      type: [
        new Schema(
          {
            questionHash: { type: String },
            wordId: { type: String, required: true },
            questionType: { type: String },
            answer: { type: String },
            templateFamily: { type: String },
            evaluationStatus: {
              type: String,
              enum: ["correct", "incorrect", "pending_review"],
              required: true,
            },
            countedInScore: { type: Boolean, default: true },
            correct: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    _id: false,
    toJSON: {
      virtuals: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform(_doc: unknown, ret: Record<string, any>) {
        ret.id = ret._id;
        delete ret.__v;
      },
    },
  }
);

LearningSessionSchema.virtual("id").get(function (this: ILearningSession) {
  return this._id;
});

LearningSessionSchema.index({ userId: 1, createdAt: -1 });

export const LearningSession: Model<ILearningSession> = mongoose.model<ILearningSession>(
  "LearningSession",
  LearningSessionSchema
);
