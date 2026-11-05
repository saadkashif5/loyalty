import { Schema, model } from "mongoose";
import { LOYALTY_CARD_STATUS } from "@taptapsell/constants";

const loyaltyCardSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    programId: { type: Schema.Types.ObjectId, ref: "LoyaltyProgram", required: true },
    stampCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: Object.values(LOYALTY_CARD_STATUS),
      default: LOYALTY_CARD_STATUS.ACTIVE,
    },
    joinedAt: { type: Date, default: () => new Date() },
    lastStampAt: { type: Date },
    // Stamps lost because the program's stamp expiry passed without a visit.
    lastExpiry: {
      at: { type: Date },
      stamps: { type: Number },
    },
    // lastStampAt the expiry warning was sent for; a new stamp re-arms it.
    expiryWarnedFor: { type: Date, default: null },
    // When the program's welcome stamp was given; the stamp-to-stamp cooldown
    // does not count it, so the first real visit is never refused.
    welcomeStampAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// A customer holds at most one active card per program (§26.2, §27).
loyaltyCardSchema.index({ customerId: 1, programId: 1 }, { unique: true });
loyaltyCardSchema.index({ businessId: 1, customerId: 1 });
loyaltyCardSchema.index({ businessId: 1, lastStampAt: -1, _id: -1 });
loyaltyCardSchema.index({ programId: 1, lastStampAt: 1 });

export const LoyaltyCard = model("LoyaltyCard", loyaltyCardSchema, "loyalty_cards");
