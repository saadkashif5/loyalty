import { Schema, model } from "mongoose";
import { PAYMENT_METHOD } from "@taptapsell/constants";

export const PROOF_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

// A receipt the owner uploads after paying by bank transfer or Raast. The
// platform team checks it against the bank statement and approves (which
// records the payment) or rejects it with a reason.
const paymentProofSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    method: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    amountPkr: { type: Number, required: true, min: 1 },
    reference: { type: String, maxlength: 120 },
    note: { type: String, maxlength: 500 },
    status: { type: String, enum: Object.values(PROOF_STATUS), default: PROOF_STATUS.PENDING },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

paymentProofSchema.index({ status: 1, createdAt: 1 });
paymentProofSchema.index({ businessId: 1, createdAt: -1 });

export const PaymentProof = model("PaymentProof", paymentProofSchema, "payment_proofs");
