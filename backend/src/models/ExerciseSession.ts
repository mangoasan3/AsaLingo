import crypto from "crypto";
import mongoose, { Document, Model, Schema } from "mongoose";

export type ExerciseSessionSource =
  | "continue_lesson"
  | "roadmap_practice"
  | "legacy_practice"
  | "daily_practice";

export interface IExerciseSession extends Document<string> {
  _id: string;
  userId: string;
  source: ExerciseSessionSource;
  cacheKey: string;
  roadmapNodeId?: string;
  mode?: "lesson" | "review" | "challenge";
  nodeSnapshot?: Record<string, unknown>;
  focusWordsSnapshot: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
  phase?: string;
  scriptSupport?: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExerciseSessionSchema = new Schema<IExerciseSession>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ["continue_lesson", "roadmap_practice", "legacy_practice", "daily_practice"],
      required: true,
    },
    cacheKey: { type: String, required: true, index: true },
    roadmapNodeId: { type: String, ref: "CurriculumNode", index: true },
    mode: {
      type: String,
      enum: ["lesson", "review", "challenge"],
    },
    nodeSnapshot: { type: Schema.Types.Mixed },
    focusWordsSnapshot: { type: [Object], default: [] },
    exercises: { type: [Object], default: [] },
    phase: { type: String },
    scriptSupport: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
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

ExerciseSessionSchema.index({ userId: 1, cacheKey: 1, createdAt: -1 });

ExerciseSessionSchema.virtual("id").get(function (this: IExerciseSession) {
  return this._id;
});

export const ExerciseSession: Model<IExerciseSession> = mongoose.model<IExerciseSession>(
  "ExerciseSession",
  ExerciseSessionSchema
);
