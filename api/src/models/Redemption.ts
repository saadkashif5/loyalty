import { Schema, model } from "mongoose";
import { REDEMPTION_STATUS } from "@taptapsell/constants";

const redemptionSchema = new Schema(
  {
    rewardId: { type: Schema.Types.ObjectId, ref: "Reward", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    loyaltyCardId: { type: Schema.Types.ObjectId, ref: "LoyaltyCard", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    redemptionCode: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: Object.values(REDEMPTION_STATUS),
      default: REDEMPTION_STATUS.PENDING,
    },
    redeemedAt: { type: Date },
    redeemedBy: { type: Schema.Types.ObjectId, ref: "User" }, // staff member who validated it
  },
  { timestamps: true },
);

redemptionSchema.index({ redemptionCode: 1 }, { unique: true });
redemptionSchema.index({ businessId: 1, createdAt: -1 });

export const Redemption = model("Redemption", redemptionSchema, "redemptions");
