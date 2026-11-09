import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const limit = { type: Number, default: null, min: 0 }; // null = unlimited

// A subscription plan (ROADMAP §7). Editable by the platform team; every edit
// bumps `version`. Subscriptions keep a copy of the price and limits they
// signed up with, so changing a plan never changes what existing businesses pay.
const planSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, maxlength: 60 },
    description: { type: String, maxlength: 500 },
    priceMonthlyPkr: { type: Number, required: true, min: 0 },
    priceAnnualPkr: { type: Number, required: true, min: 0 },
    limits: {
      branches: limit,
      programs: limit,
      stampers: limit,
      staff: limit,
      customers: limit,
    },
    // Marketing bullet points shown on the plan.
    features: [{ type: String, maxlength: 80 }],
    // What the plan switches on (PLAN_FEATURES); enforced by the API.
    flags: {
      counterMode: { type: Boolean, default: true },
      welcomeStamp: { type: Boolean, default: true },
      stampExpiry: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    // Hidden plans (e.g. Enterprise deals) can be assigned but are not offered.
    isPublic: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 100 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export type PlanDocument = HydratedDocument<InferSchemaType<typeof planSchema>>;
export const Plan = model("Plan", planSchema, "plans");
