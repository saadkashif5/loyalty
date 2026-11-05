import { Schema, model } from "mongoose";

export const CREDIT_OUTCOME = {
  /** Money sent back to the business, outside the platform. */
  REFUND: "REFUND",
  /** Kept as credit and taken off the business's next invoices. */
  CREDIT: "CREDIT",
} as const;

// Reduces what a paid invoice charged, with a reason. Numbered like invoices
// (CN-2026-27-00001) so the accountant can match them.
const creditNoteSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    invoiceNumber: { type: String, required: true },
    amountPkr: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, maxlength: 500 },
    outcome: { type: String, enum: Object.values(CREDIT_OUTCOME), required: true },
    refund: {
      method: { type: String },
      reference: { type: String, maxlength: 120 },
    },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

creditNoteSchema.index({ businessId: 1, createdAt: -1 });
creditNoteSchema.index({ invoiceId: 1 });
creditNoteSchema.index({ createdAt: -1 });

export const CreditNote = model("CreditNote", creditNoteSchema, "credit_notes");
