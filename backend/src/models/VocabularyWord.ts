import mongoose, { Schema, Document, Model } from "mongoose";
import type { CefrLevel } from "./User";

export type PartOfSpeech =
  | "NOUN"
  | "VERB"
  | "ADJECTIVE"
  | "ADVERB"
  | "PREPOSITION"
  | "CONJUNCTION"
  | "PRONOUN"
  | "INTERJECTION"
  | "PHRASE";

export interface IVocabularyWord extends Document<string> {
  _id: string;
  word: string;
  translation: string;
  definition: string;
  partOfSpeech: PartOfSpeech;
  cefrLevel: CefrLevel;
  topic?: string;
  exampleSentence: string;
  easierExplanation?: string;
  synonyms: string[];
  collocations: string[];
  pronunciation?: string;
  language: string;
  nativeLanguage: string;
  explanationLanguage: string;
  sourceType: "ai-generated" | "seed";
  generatedBy: "deepseek" | "system";
  lessonStep?: string;
  progressionStep?: number;
  roadmapNodeIds: string[];
  scriptStage?: string;
  interestTags: string[];
  grammarTags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const VocabularyWordSchema = new Schema<IVocabularyWord>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    word: { type: String, required: true, trim: true },
    translation: { type: String, required: true },
    definition: { type: String, required: true },
    partOfSpeech: {
      type: String,
      enum: [
        "NOUN",
        "VERB",
        "ADJECTIVE",
        "ADVERB",
        "PREPOSITION",
        "CONJUNCTION",
        "PRONOUN",
        "INTERJECTION",
        "PHRASE",
      ],
      default: "NOUN",
    },
    cefrLevel: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      required: true,
      index: true,
    },
    topic: { type: String, index: true },
    exampleSentence: { type: String, required: true },
    easierExplanation: { type: String },
    synonyms: { type: [String], default: [] },
    collocations: { type: [String], default: [] },
    pronunciation: { type: String },
    language: { type: String, default: "en", index: true },
    nativeLanguage: { type: String, default: "ru", index: true },
    explanationLanguage: { type: String, default: "ru", index: true },
    sourceType: {
      type: String,
      enum: ["ai-generated", "seed"],
      default: "ai-generated",
      index: true,
    },
    generatedBy: {
      type: String,
      enum: ["deepseek", "system"],
      default: "deepseek",
    },
    lessonStep: { type: String },
    progressionStep: { type: Number, default: 1 },
    roadmapNodeIds: { type: [String], default: [], index: true },
    scriptStage: { type: String, index: true },
    interestTags: { type: [String], default: [] },
    grammarTags: { type: [String], default: [] },
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

// Compound unique index
VocabularyWordSchema.index(
  { word: 1, language: 1, nativeLanguage: 1, cefrLevel: 1, sourceType: 1 },
  { unique: true }
);
// Text search index. Disable Mongo's default language_override behavior because
// this collection stores our own app language codes in the `language` field.
VocabularyWordSchema.index(
  { word: "text", definition: "text", translation: "text" },
  { language_override: "_unused_language_override" }
);

VocabularyWordSchema.virtual("id").get(function (this: IVocabularyWord) {
  return this._id;
});

export const VocabularyWord: Model<IVocabularyWord> = mongoose.model<IVocabularyWord>(
  "VocabularyWord",
  VocabularyWordSchema
);
