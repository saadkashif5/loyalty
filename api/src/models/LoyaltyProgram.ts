import { Schema, model } from "mongoose";
import { PROGRAM_STATUS } from "@taptapsell/constants";

const loyaltyProgramSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, maxlength: 2000 },
    requiredStamps: { type: Number, required: true, min: 1 },
    branches: [{ type: Schema.Types.ObjectId, ref: "Branch" }], // empty = all branches
    rewards: [{ type: Schema.Types.ObjectId, ref: "Reward" }],
    status: {
      type: String,
      enum: Object.values(PROGRAM_STATUS),
      default: PROGRAM_STATUS.ACTIVE,
    },
    startDate: { type: Date, default: () => new Date() },
    endDate: { type: Date },
    branding: {
      color: { type: String },
      icon: { type: String },
    },
    terms: { type: String },
    eligibility: { type: Schema.Types.Mixed, default: {} },
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

loyaltyProgramSchema.index({ businessId: 1, status: 1 });

export const LoyaltyProgram = model("LoyaltyProgram", loyaltyProgramSchema, "loyalty_programs");
