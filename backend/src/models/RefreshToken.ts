import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRefreshToken extends Document<string> {
  _id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
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

RefreshTokenSchema.virtual("id").get(function (this: IRefreshToken) {
  return this._id;
});

export const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>(
  "RefreshToken",
  RefreshTokenSchema
);
