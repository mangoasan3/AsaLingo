import mongoose, { Schema, Document, Model } from "mongoose";
import type { CefrLevel, ScriptStage } from "./User";
import type { SkillFocus } from "./CurriculumNode";

export type PlacementItemType =
  | "multiple_choice"
  | "fill_blank"
  | "reading_comprehension"
  | "short_production"
  | "script_recognition";

export interface IPlacementItemVariant {
  prompt: string;
  choices?: string[];
  correctAnswer?: string;
  acceptedAnswers?: string[];
}

export interface IPlacementItem extends Document<string> {
  _id: string;
  itemKey: string;
  language: string;
  nativeLanguage?: string;
  type: PlacementItemType;
  skill: SkillFocus;
  cefrLevel: CefrLevel;
  difficulty: number;
  scriptStage?: ScriptStage;
  prompt: string;
  passage?: string;
  choices: string[];
  correctAnswer?: string;
  acceptedAnswers: string[];
  productionRubric?: string;
  topics: string[];
  itemFamily: string;
  variants: IPlacementItemVariant[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlacementItemVariantSchema = new Schema<IPlacementItemVariant>(
  {
    prompt: { type: String, required: true },
    choices: { type: [String], default: undefined },
    correctAnswer: { type: String },
    acceptedAnswers: { type: [String], default: undefined },
  },
  { _id: false }
);

const PlacementItemSchema = new Schema<IPlacementItem>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    itemKey: { type: String, required: true, unique: true, index: true },
    language: { type: String, required: true, index: true },
    nativeLanguage: { type: String, index: true },
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
      index: true,
    },
    cefrLevel: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      required: true,
      index: true,
    },
    difficulty: { type: Number, required: true, min: 1, max: 6, index: true },
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
    },
    prompt: { type: String, required: true },
    passage: { type: String },
    choices: { type: [String], default: [] },
    correctAnswer: { type: String },
    acceptedAnswers: { type: [String], default: [] },
    productionRubric: { type: String },
    topics: { type: [String], default: [] },
    itemFamily: { type: String, required: true, index: true },
    variants: { type: [PlacementItemVariantSchema], default: [] },
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

PlacementItemSchema.index({ language: 1, cefrLevel: 1, difficulty: 1, skill: 1 });
PlacementItemSchema.index({ language: 1, itemFamily: 1 });

PlacementItemSchema.virtual("id").get(function (this: IPlacementItem) {
  return this._id;
});

export const PlacementItem: Model<IPlacementItem> = mongoose.model<IPlacementItem>(
  "PlacementItem",
  PlacementItemSchema
);
