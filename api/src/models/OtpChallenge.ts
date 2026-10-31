import { Schema, model } from "mongoose";

// A one-time sign-in code sent by email. Only an HMAC of the code is stored,
// keyed with a server secret, so a copy of the database cannot be used to try
// all million codes offline. Moves to Redis with the rest of the short-lived
// state (ROADMAP Phase 4).
const otpChallengeSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

otpChallengeSchema.index({ email: 1, createdAt: -1 });
// Kept an hour past expiry for the resend cooldown and troubleshooting.
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const OtpChallenge = model("OtpChallenge", otpChallengeSchema, "otp_challenges");
