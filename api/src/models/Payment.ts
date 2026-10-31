import { Schema, model } from "mongoose";
import { PAYMENT_METHOD } from "@taptapsell/constants";

// Money received for a subscription. Recorded by the platform team for bank
// transfers, Raast, cash and cheques; a card gateway will add its own later.
const paymentSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true },
    amountPkr: { type: Number, required: true, min: 1 },
    method: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    reference: { type: String, maxlength: 120 },
    note: { type: String, maxlength: 500 },
    periods: { type: Number, required: true, min: 1 },
    // The service period this payment covered.
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

paymentSchema.index({ businessId: 1, createdAt: -1 });
paymentSchema.index({ createdAt: -1 });

export const Payment = model("Payment", paymentSchema, "payments");
