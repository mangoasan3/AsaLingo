import mongoose, { Schema, Document, Model } from "mongoose";
import type {
  CefrLevel,
  ISubskillProfile,
  LearnerStage,
  ScriptStage,
} from "./User";
import type { SkillFocus } from "./CurriculumNode";
import type { PlacementItemType } from "./PlacementItem";

export type PlacementSessionStatus = "active" | "finished" | "abandoned";

export interface IPlacementAnswerRecord {
  itemId: string;
  itemKey: string;
  type: PlacementItemType;
  skill: SkillFocus;
  difficulty: number;
  cefrLevel: CefrLevel;
  itemFamily: string;
  variantIndex: number;
  prompt: string;
  answer?: string;
  correct?: boolean;
  score?: number;
  submittedAt?: Date;
}

export interface IPlacementResult {
  estimatedLevel: CefrLevel;
  confidence: number;
  subskillProfile: ISubskillProfile;
  recommendedRoadmapNodeId?: string;
  learnerStage: LearnerStage;
  scriptStage: ScriptStage;
}

export interface IPlacementSession extends Document<string> {
  _id: string;
  userId: string;
  language: string;
  nativeLanguage: string;
  status: PlacementSessionStatus;
  seed: string;
  currentDifficulty: number;
  targetItemCount: number;
  answeredCount: number;
  askedItems: IPlacementAnswerRecord[];
  result?: IPlacementResult;
  startedAt: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PlacementAnswerRecordSchema = new Schema<IPlacementAnswerRecord>(
  {
    itemId: { type: String, required: true },
    itemKey: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "multiple_choice",
        "fill_blank",
        "reading_comprehension",
        "short_production",
        "script_recognition",
      ],
      required: true,
    },
    skill: {
      type: String,
      enum: ["vocabulary", "grammar", "reading", "listening", "writing", "speaking", "script"],
      required: true,
    },
    difficulty: { type: Number, required: true },
    cefrLevel: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      required: true,
    },
    itemFamily: { type: String, required: true },
    variantIndex: { type: Number, default: 0 },
    prompt: { type: String, required: true },
    answer: { type: String },
    correct: { type: Boolean },
    score: { type: Number, min: 0, max: 1 },
    submittedAt: { type: Date },
  },
  { _id: false }
);

const SubskillProfileSchema = new Schema<ISubskillProfile>(
  {
    vocabulary: { type: Number, default: 0, min: 0, max: 1 },
    grammar: { type: Number, default: 0, min: 0, max: 1 },
    reading: { type: Number, default: 0, min: 0, max: 1 },
    listening: { type: Number, default: 0, min: 0, max: 1 },
    writing: { type: Number, default: 0, min: 0, max: 1 },
    updatedAt: { type: Date },
  },
  { _id: false }
);

const PlacementResultSchema = new Schema<IPlacementResult>(
  {
    estimatedLevel: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      required: true,
    },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    subskillProfile: { type: SubskillProfileSchema, required: true },
    recommendedRoadmapNodeId: { type: String, ref: "CurriculumNode" },
    learnerStage: {
      type: String,
      enum: [
        "absolute_beginner",
        "early_beginner",
        "late_beginner",
        "intermediate",
        "upper_intermediate",
        "advanced",
      ],
      required: true,
    },
    scriptStage: {
      type: String,
      enum: [
        "latin",
        "romaji",
        "kana_intro",
        "kana_supported",
        "kana_confident",
        "kanji_intro",
        "kanji_supported",
        "kanji_confident",
        "native_script",
      ],
      required: true,
    },
  },
  { _id: false }
);

const PlacementSessionSchema = new Schema<IPlacementSession>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    language: { type: String, required: true, index: true },
    nativeLanguage: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "finished", "abandoned"],
      default: "active",
      index: true,
    },
    seed: { type: String, required: true },
    currentDifficulty: { type: Number, default: 2, min: 1, max: 6 },
    targetItemCount: { type: Number, default: 8, min: 4, max: 16 },
    answeredCount: { type: Number, default: 0 },
    askedItems: { type: [PlacementAnswerRecordSchema], default: [] },
    result: { type: PlacementResultSchema },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
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

PlacementSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });

PlacementSessionSchema.virtual("id").get(function (this: IPlacementSession) {
  return this._id;
});

export const PlacementSession: Model<IPlacementSession> = mongoose.model<IPlacementSession>(
  "PlacementSession",
  PlacementSessionSchema
);
