import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

export const INVITATION_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REVOKED: "REVOKED",
} as const;

// Invitation for a business owner, sent by the platform (ROADMAP Phase 1).
// The link token is stored hashed; resending issues a new token, so an older
// link stops working. "Expired" is derived from expiresAt.
const businessInvitationSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    tokenHash: { type: String, required: true, unique: true, private: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(INVITATION_STATUS),
      default: INVITATION_STATUS.PENDING,
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sendCount: { type: Number, default: 1 },
    lastSentAt: { type: Date, default: () => new Date() },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

businessInvitationSchema.index({ businessId: 1, createdAt: -1 });

export type BusinessInvitationDocument = HydratedDocument<
  InferSchemaType<typeof businessInvitationSchema>
>;

export const BusinessInvitation = model(
  "BusinessInvitation",
  businessInvitationSchema,
  "business_invitations",
);
