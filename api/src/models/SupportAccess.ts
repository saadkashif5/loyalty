import { Schema, model } from "mongoose";

// A platform team member's read-only look at one business's dashboard, for
// answering support questions. Time-limited, with a reason, and every page
// the person opens is kept with the grant.
const supportAccessSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    reason: { type: String, required: true, maxlength: 300 },
    expiresAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    views: {
      type: [{ _id: false, method: String, path: String, at: Date }],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

supportAccessSchema.index({ userId: 1, businessId: 1, endedAt: 1, expiresAt: -1 });
supportAccessSchema.index({ businessId: 1, createdAt: -1 });

export const SupportAccess = model("SupportAccess", supportAccessSchema, "support_access");
