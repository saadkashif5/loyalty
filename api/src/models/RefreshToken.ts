import { Schema, model } from "mongoose";

// Refresh tokens are stored hashed (never raw) so a DB leak alone cannot be
// used to mint sessions. Enables revocation/session management per PRD §23.1.
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, private: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null, private: true },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model("RefreshToken", refreshTokenSchema, "refresh_tokens");
