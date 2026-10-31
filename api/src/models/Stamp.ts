import { Schema, model } from "mongoose";
import { STAMP_SOURCE, STAMP_STATUS } from "@taptapsell/constants";

const stampSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    loyaltyCardId: { type: Schema.Types.ObjectId, ref: "LoyaltyCard", required: true },
    programId: { type: Schema.Types.ObjectId, ref: "LoyaltyProgram", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    deviceId: { type: Schema.Types.ObjectId, ref: "NfcDevice" }, // absent for ADMIN/STAFF stamps
    // Staff member who added the stamp (counter and manual stamps).
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
    source: { type: String, enum: Object.values(STAMP_SOURCE), required: true },
    status: { type: String, enum: Object.values(STAMP_STATUS), default: STAMP_STATUS.VALID },
    idempotencyKey: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} }, // device/request metadata, never used for authorization
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Prevents a retried request (same idempotency key) from creating a duplicate stamp (§13.1, §28).
stampSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });
stampSchema.index({ customerId: 1, programId: 1, createdAt: -1 });
stampSchema.index({ businessId: 1, branchId: 1, createdAt: -1 });
// Business-wide time ranges (activity feed, analytics) without a branch filter.
stampSchema.index({ businessId: 1, createdAt: -1 });
// Daily caps: per card, per staff member, and per stamper for burst detection.
stampSchema.index({ loyaltyCardId: 1, createdAt: -1 });
stampSchema.index({ businessId: 1, issuedBy: 1, createdAt: -1 });
stampSchema.index({ deviceId: 1, createdAt: -1 });

export const Stamp = model("Stamp", stampSchema, "stamps");
