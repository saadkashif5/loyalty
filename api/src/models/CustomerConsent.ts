import { Schema, model } from "mongoose";

// A customer's say on whether one business may message them on WhatsApp.
// Withdrawing keeps the record (with the time), so it is clear who agreed
// to what, and when.
const customerConsentSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    whatsapp: { type: Boolean, default: false },
    grantedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
  },
  { timestamps: true },
);

customerConsentSchema.index({ customerId: 1, businessId: 1 }, { unique: true });
customerConsentSchema.index({ businessId: 1, whatsapp: 1 });

export const CustomerConsent = model("CustomerConsent", customerConsentSchema, "customer_consents");
