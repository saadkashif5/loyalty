import { Schema, model } from "mongoose";
import { REWARD_STATUS } from "@taptapsell/constants";

const rewardSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    programId: { type: Schema.Types.ObjectId, ref: "LoyaltyProgram", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, maxlength: 2000 },
    type: {
      type: String,
      enum: ["FREE_ITEM", "PERCENT_OFF", "FIXED_DISCOUNT", "OTHER"],
      required: true,
    },
    value: { type: Schema.Types.Mixed }, // e.g. { amount: 500, currency: "PKR" } or { percent: 20 }
    requiredStamps: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: Object.values(REWARD_STATUS),
      default: REWARD_STATUS.ACTIVE,
    },
    expiresAt: { type: Date },
    terms: { type: String },
    redemptionLimit: { type: Number, default: 1 }, // per loyalty card, unless configured otherwise
    // Days the customer has to use it once unlocked; unset means it never expires.
    validForDays: { type: Number, min: 1 },
  },
  { timestamps: true },
);

rewardSchema.index({ programId: 1, status: 1 });

export const Reward = model("Reward", rewardSchema, "rewards");
