import mongoose, { Schema, Document, Model } from "mongoose";
import type { CefrLevel, LearnerStage, ScriptStage } from "./User";

export type SkillFocus =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "script";

export type EvaluationMode = "exact" | "auto" | "ai" | "rubric";

export interface IExerciseMixItem {
  type: string;
  weight: number;
  skill: SkillFocus;
  difficulty: number;
  evaluationMode: EvaluationMode;
  mediaNeeds?: "none" | "image" | "audio" | "video";
  templateFamily?: string;
}

export interface IUnlockCriteria {
  previousNodeIds: string[];
  minScore?: number;
  minIntroducedWords?: number;
}

export interface ICurriculumNode extends Document<string> {
  _id: string;
  nodeKey: string;
  language: string;
  level: CefrLevel;
  learnerStage: LearnerStage;
  stage: string;
  stageOrder: number;
  unit: number;
  lesson: number;
  title: string;
  objective: string;
  description?: string;
  unlockCriteria: IUnlockCriteria;
  skillFocus: SkillFocus[];
  scriptFocus?: ScriptStage;
  exerciseMix: IExerciseMixItem[];
  recommendedVocabulary: string[];
  grammarTargets: string[];
  interestTags: string[];
  estimatedMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExerciseMixItemSchema = new Schema<IExerciseMixItem>(
  {
    type: { type: String, required: true },
    weight: { type: Number, default: 1, min: 0 },
    skill: {
      type: String,
      enum: ["vocabulary", "grammar", "reading", "listening", "writing", "speaking", "script"],
      required: true,
    },
    difficulty: { type: Number, default: 1, min: 1, max: 6 },
    evaluationMode: {
      type: String,
      enum: ["exact", "auto", "ai", "rubric"],
      default: "auto",
    },
    mediaNeeds: {
      type: String,
      enum: ["none", "image", "audio", "video"],
      default: "none",
    },
    templateFamily: { type: String },
  },
  { _id: false }
);

const CurriculumNodeSchema = new Schema<ICurriculumNode>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    nodeKey: { type: String, required: true, unique: true, index: true },
    language: { type: String, required: true, index: true },
    level: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      required: true,
      index: true,
    },
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
      index: true,
    },
    stage: { type: String, required: true },
    stageOrder: { type: Number, required: true, index: true },
    unit: { type: Number, required: true },
    lesson: { type: Number, required: true },
    title: { type: String, required: true },
    objective: { type: String, required: true },
    description: { type: String },
    unlockCriteria: {
      previousNodeIds: { type: [String], default: [] },
      minScore: { type: Number, min: 0, max: 1 },
      minIntroducedWords: { type: Number, min: 0 },
    },
    skillFocus: {
      type: [String],
      enum: ["vocabulary", "grammar", "reading", "listening", "writing", "speaking", "script"],
      default: ["vocabulary"],
    },
    scriptFocus: {
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
    },
    exerciseMix: { type: [ExerciseMixItemSchema], default: [] },
    recommendedVocabulary: { type: [String], default: [] },
    grammarTargets: { type: [String], default: [] },
    interestTags: { type: [String], default: [] },
    estimatedMinutes: { type: Number, default: 8 },
    isActive: { type: Boolean, default: true, index: true },
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

CurriculumNodeSchema.index({ language: 1, level: 1, stageOrder: 1 });
CurriculumNodeSchema.index({ language: 1, level: 1, unit: 1, lesson: 1 }, { unique: true });

CurriculumNodeSchema.virtual("id").get(function (this: ICurriculumNode) {
  return this._id;
});

export const CurriculumNode: Model<ICurriculumNode> = mongoose.model<ICurriculumNode>(
  "CurriculumNode",
  CurriculumNodeSchema
);
