import { Schema, model } from "mongoose";
import { FRAUD_FLAG_STATUS, FRAUD_FLAG_TYPE } from "@taptapsell/constants";

// Something about stamping that looks wrong, for the owner (and the platform
// team) to review. Repeats of the same open problem increase `occurrences`
// on one flag instead of creating a new one each time.
const fraudFlagSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    type: { type: String, enum: Object.values(FRAUD_FLAG_TYPE), required: true },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
    message: { type: String, required: true, maxlength: 500 },
    deviceId: { type: Schema.Types.ObjectId, ref: "NfcDevice" },
    staffUserId: { type: Schema.Types.ObjectId, ref: "User" },
    details: { type: Schema.Types.Mixed, default: {} },
    occurrences: { type: Number, default: 1 },
    lastSeenAt: { type: Date, default: () => new Date() },
    status: {
      type: String,
      enum: Object.values(FRAUD_FLAG_STATUS),
      default: FRAUD_FLAG_STATUS.OPEN,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

fraudFlagSchema.index({ businessId: 1, status: 1, lastSeenAt: -1 });
fraudFlagSchema.index({ status: 1, lastSeenAt: -1 });

export const FraudFlag = model("FraudFlag", fraudFlagSchema, "fraud_flags");
