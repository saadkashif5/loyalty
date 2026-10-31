import { Schema, model } from "mongoose";

// A business asking to join from the marketing site's "request access" form.
// The platform team works the list and converts a lead by inviting its owner.
const leadSchema = new Schema(
  {
    businessName: { type: String, required: true, trim: true, maxlength: 160 },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, required: true },
    branches: { type: Number },
    message: { type: String, maxlength: 1000 },
    status: {
      type: String,
      enum: ["NEW", "CONTACTED", "CONVERTED", "REJECTED"],
      default: "NEW",
    },
    notes: [
      {
        text: { type: String, required: true, maxlength: 1000 },
        by: { type: Schema.Types.ObjectId, ref: "User", required: true },
        at: { type: Date, default: () => new Date() },
      },
    ],
    businessId: { type: Schema.Types.ObjectId, ref: "Business" },
  },
  { timestamps: true },
);

leadSchema.index({ status: 1, createdAt: -1 });

export const Lead = model("Lead", leadSchema, "leads");
