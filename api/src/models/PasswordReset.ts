import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

// A single-use link to set a new password. Only a hash of the token is kept,
// so a database leak does not hand out working links.
const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true, private: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

passwordResetSchema.index({ userId: 1, usedAt: 1 });
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });

export type PasswordResetDocument = HydratedDocument<InferSchemaType<typeof passwordResetSchema>>;
export const PasswordReset = model("PasswordReset", passwordResetSchema, "password_resets");
