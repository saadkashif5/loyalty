import { Schema, model } from "mongoose";

const auditLogSchema = new Schema(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    actorRole: { type: String }, // platform or business role at time of action
    businessId: { type: Schema.Types.ObjectId, ref: "Business" },
    action: { type: String, required: true }, // e.g. "device.revoked", "reward.redeemed"
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ businessId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export const AuditLog = model("AuditLog", auditLogSchema, "audit_logs");
