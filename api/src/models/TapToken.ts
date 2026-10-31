import { Schema, model } from "mongoose";

// Single-use proof that a customer tapped a stamper moments ago. Issued by
// POST /taps after the tag's tap is verified, consumed by POST /stamps inside
// the stamp transaction. Stored hashed, like refresh tokens.
const tapTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    deviceId: { type: Schema.Types.ObjectId, ref: "NfcDevice", required: true },
    deviceIdentifier: { type: String, required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    tapCounter: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    consumedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Kept for an hour after expiry for troubleshooting, then removed.
tapTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const TapToken = model("TapToken", tapTokenSchema, "tap_tokens");
