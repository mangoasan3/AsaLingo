import mongoose, { Schema, Document, Model } from "mongoose";

export type RoadmapProgressStatus = "locked" | "available" | "in_progress" | "completed";

export interface IUserRoadmapProgress extends Document<string> {
  _id: string;
  userId: string;
  nodeId: string;
  status: RoadmapProgressStatus;
  progressPercent: number;
  attempts: number;
  bestScore?: number;
  lastScore?: number;
  introducedWordIds: string[];
  completedExerciseTypes: string[];
  unlockedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  lastPracticedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserRoadmapProgressSchema = new Schema<IUserRoadmapProgress>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    nodeId: { type: String, required: true, ref: "CurriculumNode", index: true },
    status: {
      type: String,
      enum: ["locked", "available", "in_progress", "completed"],
      default: "locked",
      index: true,
    },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    attempts: { type: Number, default: 0 },
    bestScore: { type: Number, min: 0, max: 1 },
    lastScore: { type: Number, min: 0, max: 1 },
    introducedWordIds: { type: [String], default: [] },
    completedExerciseTypes: { type: [String], default: [] },
    unlockedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    lastPracticedAt: { type: Date },
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

UserRoadmapProgressSchema.index({ userId: 1, nodeId: 1 }, { unique: true });
UserRoadmapProgressSchema.index({ userId: 1, status: 1, updatedAt: -1 });

UserRoadmapProgressSchema.virtual("id").get(function (this: IUserRoadmapProgress) {
  return this._id;
});

export const UserRoadmapProgress: Model<IUserRoadmapProgress> =
  mongoose.model<IUserRoadmapProgress>("UserRoadmapProgress", UserRoadmapProgressSchema);
