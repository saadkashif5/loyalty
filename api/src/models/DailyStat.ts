import { Schema, model } from "mongoose";

// Counters per business per Pakistan day, bumped as things happen, so reports
// read a few small documents instead of scanning stamps and taps. Tap counts
// exist only here: tap tokens are deleted soon after they expire.
const dailyStatSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    /** yyyy-mm-dd in Pakistan time. */
    day: { type: String, required: true },
    tapsVerified: { type: Number, default: 0 },
    tapsRejected: { type: Number, default: 0 },
    stamps: { type: Number, default: 0 },
    newCards: { type: Number, default: 0 },
    rewardsUnlocked: { type: Number, default: 0 },
    rewardsRedeemed: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false },
);

dailyStatSchema.index({ businessId: 1, day: 1 }, { unique: true });
dailyStatSchema.index({ day: 1 });

export const DailyStat = model("DailyStat", dailyStatSchema, "daily_stats");
