import { Schema, model } from "mongoose";
import { BUSINESS_ROLES, MEMBER_STATUS } from "@taptapsell/constants";

// Authorization source of truth for business-scoped roles (PRD §6).
// A global user.role field must never be used for business authorization.
const businessMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    branchIds: [{ type: Schema.Types.ObjectId, ref: "Branch" }], // empty = all branches
    role: { type: String, enum: Object.values(BUSINESS_ROLES), required: true },
    permissions: [{ type: String }], // optional overrides beyond role defaults
    status: {
      type: String,
      enum: Object.values(MEMBER_STATUS),
      default: MEMBER_STATUS.INVITED,
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

businessMemberSchema.index({ userId: 1, businessId: 1 }, { unique: true });

export const BusinessMember = model("BusinessMember", businessMemberSchema, "business_members");
