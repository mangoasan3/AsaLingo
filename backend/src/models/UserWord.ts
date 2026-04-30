import mongoose, { Schema, Document, Model } from "mongoose";
import type { IVocabularyWord } from "./VocabularyWord";

export type WordStatus = "NEW" | "LEARNING" | "LEARNED" | "DIFFICULT" | "SAVED";

export interface IUserWord extends Document<string> {
  _id: string;
  userId: string;
  wordId: string;
  status: WordStatus;
  timesReviewed: number;
  correctCount: number;
  learnedAt?: Date;
  savedAt?: Date;
  nextReviewAt?: Date;
  lastPracticedAt?: Date;
  masteryState: "introduced" | "practicing" | "reviewing" | "mastered";
  progressionStep?: number;
  introducedAt?: Date;
  introducedBy: "roadmap" | "practice" | "manual" | "ai";
  firstSeenRoadmapNodeId?: string;
  roadmapNodeIds: string[];
  exposureCount: number;
  lastSeenRoadmapNodeId?: string;
  lessonStep?: "introduction" | "recognition" | "controlled_production" | "review";
  templateFamiliesSeen: string[];
  createdAt: Date;
  updatedAt: Date;
  // Populated field
  word?: IVocabularyWord;
}

const UserWordSchema = new Schema<IUserWord>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    wordId: { type: String, required: true, ref: "VocabularyWord" },
    status: {
      type: String,
      enum: ["NEW", "LEARNING", "LEARNED", "DIFFICULT", "SAVED"],
      default: "NEW",
      index: true,
    },
    timesReviewed: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    learnedAt: { type: Date },
    savedAt: { type: Date },
    nextReviewAt: { type: Date },
    lastPracticedAt: { type: Date },
    masteryState: {
      type: String,
      enum: ["introduced", "practicing", "reviewing", "mastered"],
      default: "introduced",
    },
    progressionStep: { type: Number, default: 1 },
    introducedAt: { type: Date },
    introducedBy: {
      type: String,
      enum: ["roadmap", "practice", "manual", "ai"],
      default: "practice",
      index: true,
    },
    firstSeenRoadmapNodeId: { type: String, ref: "CurriculumNode", index: true },
    roadmapNodeIds: { type: [String], default: [] },
    exposureCount: { type: Number, default: 0 },
    lastSeenRoadmapNodeId: { type: String, ref: "CurriculumNode" },
    lessonStep: {
      type: String,
      enum: ["introduction", "recognition", "controlled_production", "review"],
    },
    templateFamiliesSeen: { type: [String], default: [] },
  },
  {
    timestamps: true,
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

// Compound unique index: one entry per user per word
UserWordSchema.index({ userId: 1, wordId: 1 }, { unique: true });
UserWordSchema.index({ userId: 1, nextReviewAt: 1, masteryState: 1 });
UserWordSchema.index({ userId: 1, roadmapNodeIds: 1 });

UserWordSchema.virtual("id").get(function (this: IUserWord) {
  return this._id;
});

export const UserWord: Model<IUserWord> = mongoose.model<IUserWord>(
  "UserWord",
  UserWordSchema
);
