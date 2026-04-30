import mongoose, { Schema, Document, Model } from "mongoose";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type AuthProvider = "EMAIL" | "GOOGLE";
export type PlacementSource = "manual" | "placement_test";
export type LearnerStage =
  | "absolute_beginner"
  | "early_beginner"
  | "late_beginner"
  | "intermediate"
  | "upper_intermediate"
  | "advanced";
export type ScriptStage =
  | "latin"
  | "romaji"
  | "kana_intro"
  | "kana_supported"
  | "kana_confident"
  | "kanji_intro"
  | "kanji_supported"
  | "kanji_confident"
  | "native_script";
export type ContentStyle = "playful" | "balanced" | "practical" | "academic" | "challenge";

export interface ISubskillProfile {
  vocabulary: number;
  grammar: number;
  reading: number;
  listening: number;
  writing: number;
  updatedAt?: Date;
}

export interface IUser extends Document<string> {
  _id: string;
  name: string;
  email: string;
  passwordHash?: string;
  authProvider: AuthProvider;
  googleId?: string;
  avatar?: string;
  studyLanguage: string;
  nativeLanguage: string;
  currentLevel: CefrLevel;
  placementSource: PlacementSource;
  placementConfidence: number;
  subskillProfile: ISubskillProfile;
  learnerStage: LearnerStage;
  scriptStage: ScriptStage;
  learningGoal?: string;
  interests: string[];
  preferredContentStyle: ContentStyle;
  currentRoadmapNodeId?: string;
  onboardingVersion: "legacy" | "learning_v1";
  onboardingDone: boolean;
  streak: number;
  lastStudiedAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String },
    authProvider: { type: String, enum: ["EMAIL", "GOOGLE"], default: "EMAIL" },
    googleId: { type: String, sparse: true, unique: true, index: true },
    avatar: { type: String },
    studyLanguage: { type: String, default: "en" },
    nativeLanguage: { type: String, default: "ru" },
    currentLevel: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      default: "A1",
    },
    placementSource: {
      type: String,
      enum: ["manual", "placement_test"],
      default: "manual",
      index: true,
    },
    placementConfidence: { type: Number, default: 0.35, min: 0, max: 1 },
    subskillProfile: {
      vocabulary: { type: Number, default: 0.2, min: 0, max: 1 },
      grammar: { type: Number, default: 0.2, min: 0, max: 1 },
      reading: { type: Number, default: 0.2, min: 0, max: 1 },
      listening: { type: Number, default: 0.1, min: 0, max: 1 },
      writing: { type: Number, default: 0.1, min: 0, max: 1 },
      updatedAt: { type: Date },
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
      default: "absolute_beginner",
      index: true,
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
      default: "latin",
      index: true,
    },
    learningGoal: { type: String },
    interests: { type: [String], default: [] },
    preferredContentStyle: {
      type: String,
      enum: ["playful", "balanced", "practical", "academic", "challenge"],
      default: "balanced",
    },
    currentRoadmapNodeId: { type: String, ref: "CurriculumNode", index: true },
    onboardingVersion: {
      type: String,
      enum: ["legacy", "learning_v1"],
      default: "legacy",
      index: true,
    },
    onboardingDone: { type: Boolean, default: false },
    streak: { type: Number, default: 0 },
    lastStudiedAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
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

UserSchema.virtual("id").get(function (this: IUser) {
  return this._id;
});

export const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);
