import mongoose, { Schema, Document, Model } from "mongoose";
import type { CefrLevel } from "./User";

export interface IAIContentCache extends Document<string> {
  _id: string;
  wordId: string;
  cefrLevel: CefrLevel;
  contentType: string;
  nativeLanguage: string;
  content: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
}

const AIContentCacheSchema = new Schema<IAIContentCache>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    wordId: { type: String, required: true, index: true },
    cefrLevel: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      required: true,
    },
    contentType: { type: String, required: true },
    nativeLanguage: { type: String, default: "Russian" },
    content: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
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

// Compound unique index: one cache entry per word + level + type + language
AIContentCacheSchema.index(
  { wordId: 1, cefrLevel: 1, contentType: 1, nativeLanguage: 1 },
  { unique: true }
);

AIContentCacheSchema.virtual("id").get(function (this: IAIContentCache) {
  return this._id;
});

export const AIContentCache: Model<IAIContentCache> = mongoose.model<IAIContentCache>(
  "AIContentCache",
  AIContentCacheSchema
);
