import { Schema, model } from "mongoose";
import { BUSINESS_STATUS } from "@taptapsell/constants";

const businessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    description: { type: String, maxlength: 2000 },
    logo: { type: String },
    category: {
      type: String,
      enum: ["CAFE", "RESTAURANT", "BAKERY", "SALON", "BARBER", "GYM", "RETAIL", "OTHER"],
      default: "OTHER",
    },
    contact: {
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      address: { type: String },
    },
    status: {
      type: String,
      enum: Object.values(BUSINESS_STATUS),
      default: BUSINESS_STATUS.PENDING,
    },
    // Why the platform suspended the business; shown on its read-only dashboard.
    suspension: {
      // ADMIN: suspended by the platform team. BILLING: unpaid subscription;
      // lifts automatically on payment.
      kind: { type: String, enum: ["ADMIN", "BILLING"] },
      reason: { type: String, maxlength: 500 },
      at: { type: Date },
    },
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const Business = model("Business", businessSchema, "businesses");
