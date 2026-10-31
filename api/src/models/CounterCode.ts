import { Schema, model } from "mongoose";

// The short code a customer's card shows for counter stamps. It changes
// every couple of minutes and works once, so showing it proves the customer
// is at the counter: a screenshot shared with a friend stops working quickly.
const counterCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    loyaltyCardId: { type: Schema.Types.ObjectId, ref: "LoyaltyCard", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

counterCodeSchema.index({ loyaltyCardId: 1, createdAt: -1 });
counterCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const CounterCode = model("CounterCode", counterCodeSchema, "counter_codes");
