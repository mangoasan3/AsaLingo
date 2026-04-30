import mongoose, { Schema, Document, Model } from "mongoose";
import type { CefrLevel } from "./User";
import type { SkillFocus } from "./CurriculumNode";

export interface IMediaTask extends Document<string> {
  _id: string;
  sourceUrl: string;
  provider: "youtube" | "external";
  clipTitle: string;
  transcriptSegment: string;
  startSeconds: number;
  endSeconds: number;
  difficulty: number;
  level: CefrLevel;
  language: string;
  topic: string;
  roadmapNodeIds: string[];
  skillFocus: SkillFocus[];
  exerciseTypes: string[];
  questions: Array<{
    question: string;
    passage: string;
    correctAnswer: string;
    options: string[];
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MediaQuestionSchema = new Schema(
  {
    question: { type: String, required: true },
    passage: { type: String, required: true },
    correctAnswer: { type: String, required: true },
    options: { type: [String], default: [] },
  },
  { _id: false }
);

const MediaTaskSchema = new Schema<IMediaTask>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    sourceUrl: { type: String, required: true },
    provider: { type: String, enum: ["youtube", "external"], default: "youtube" },
    clipTitle: { type: String, required: true },
    transcriptSegment: { type: String, required: true },
    startSeconds: { type: Number, required: true, min: 0 },
    endSeconds: { type: Number, required: true, min: 0 },
    difficulty: { type: Number, default: 2, min: 1, max: 6, index: true },
    level: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      default: "A2",
      index: true,
    },
    language: { type: String, required: true, index: true },
    topic: { type: String, required: true, index: true },
    roadmapNodeIds: { type: [String], default: [], index: true },
    skillFocus: {
      type: [String],
      enum: ["vocabulary", "grammar", "reading", "listening", "writing", "speaking", "script"],
      default: ["listening"],
    },
    exerciseTypes: { type: [String], default: ["transcript_gap_fill"] },
    questions: { type: [MediaQuestionSchema], default: [] },
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

MediaTaskSchema.index({ language: 1, level: 1, topic: 1 });

MediaTaskSchema.virtual("id").get(function (this: IMediaTask) {
  return this._id;
});

export const MediaTask: Model<IMediaTask> = mongoose.model<IMediaTask>(
  "MediaTask",
  MediaTaskSchema
);
