import { Schema, model } from "mongoose";

// A promotion code, e.g. LAUNCH50: a percentage or a fixed amount off the plan
// part of the next N invoices. Hardware charges are never discounted.
const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, maxlength: 200 },
    percentOff: { type: Number, min: 1, max: 100, default: null },
    amountOffPkr: { type: Number, min: 1, default: null },
    /** How many invoices in a row it applies to. */
    invoices: { type: Number, min: 1, max: 24, default: 1 },
    /** Empty means any plan. */
    planCodes: { type: [String], default: [] },
    maxRedemptions: { type: Number, min: 1, default: null },
    redemptions: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const Coupon = model("Coupon", couponSchema, "coupons");
