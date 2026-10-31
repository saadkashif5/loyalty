import { Schema, model } from "mongoose";
import { BRANCH_STATUS } from "@taptapsell/constants";

const branchSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    address: { type: String },
    location: {
      // No default: a Point without coordinates is rejected by the 2dsphere
      // index, so a branch without a location must store no location at all.
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },
    contact: {
      phone: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: Object.values(BRANCH_STATUS),
      default: BRANCH_STATUS.ACTIVE,
    },
  },
  { timestamps: true },
);

branchSchema.index({ businessId: 1 });
branchSchema.index({ location: "2dsphere" });

export const Branch = model("Branch", branchSchema, "branches");
