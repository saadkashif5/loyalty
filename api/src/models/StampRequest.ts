import { Schema, model } from "mongoose";

export const STAMP_REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

// A counter stamp a staff member asked for after passing the business's
// approval threshold for the day. A manager or the owner approves it (the
// stamp is then added) or turns it down. The customer's card code was spent
// when it was asked for, so it cannot be used again meanwhile.
const stampRequestSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    loyaltyCardId: { type: Schema.Types.ObjectId, ref: "LoyaltyCard", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    programId: { type: Schema.Types.ObjectId, ref: "LoyaltyProgram", required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // The staff member's request key: a retry returns this request again.
    idempotencyKey: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(STAMP_REQUEST_STATUS),
      default: STAMP_REQUEST_STATUS.PENDING,
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    reason: { type: String, maxlength: 300 },
    stampId: { type: Schema.Types.ObjectId, ref: "Stamp" },
  },
  { timestamps: true },
);

stampRequestSchema.index({ requestedBy: 1, idempotencyKey: 1 }, { unique: true });
stampRequestSchema.index({ businessId: 1, status: 1, createdAt: -1 });

export const StampRequest = model("StampRequest", stampRequestSchema, "stamp_requests");
