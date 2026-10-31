import { BusinessMember, User } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { BUSINESS_ROLES, MEMBER_STATUS } from "@taptapsell/constants";
import type { InviteMemberInput, UpdateMemberInput } from "@taptapsell/validation";

export async function listMembers(businessId: string) {
  return BusinessMember.find({ businessId }).populate("userId", "name email phone status");
}

// Invites an existing platform user into a business. A user already registered
// as a customer keeps that identity — membership is additive (§6).
export async function inviteMember(
  businessId: string,
  actorUserId: string,
  input: InviteMemberInput,
) {
  const user = await User.findOne({ email: input.email });
  if (!user) {
    throw ApiError.notFound("No account exists with that email. Ask them to sign up first.");
  }

  const existing = await BusinessMember.findOne({ userId: user._id, businessId });
  if (existing) {
    throw ApiError.conflict("This user is already a member of the business");
  }

  const member = await BusinessMember.create({
    userId: user._id,
    businessId,
    role: input.role,
    branchIds: input.branchIds ?? [],
    status: MEMBER_STATUS.INVITED,
    invitedBy: actorUserId,
  });

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.MEMBER_INVITED,
    resourceType: "BusinessMember",
    resourceId: member._id,
    metadata: { role: input.role, invitedUserId: user._id.toString() },
  });

  return member;
}

export async function updateMember(
  businessId: string,
  memberId: string,
  actorUserId: string,
  input: UpdateMemberInput,
) {
  const member = await BusinessMember.findOne({ _id: memberId, businessId });
  if (!member) throw ApiError.notFound("Member not found");

  // The OWNER record is not editable through this route; ownership changes go
  // through an explicit transfer flow (§5.2).
  if (member.role === BUSINESS_ROLES.OWNER) {
    throw ApiError.forbidden("The business owner cannot be modified here");
  }

  if (input.role) member.role = input.role;
  if (input.branchIds) member.set("branchIds", input.branchIds);
  if (input.status) member.status = input.status;
  await member.save();

  await recordAudit({
    actorUserId,
    businessId,
    action:
      input.status === "DISABLED"
        ? AUDIT_ACTIONS.MEMBER_DISABLED
        : AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
    resourceType: "BusinessMember",
    resourceId: memberId,
    metadata: { ...input },
  });

  return member;
}

// Accepting an invite is done by the invited user themselves.
export async function acceptInvite(businessId: string, userId: string) {
  const member = await BusinessMember.findOne({
    businessId,
    userId,
    status: MEMBER_STATUS.INVITED,
  });
  if (!member) throw ApiError.notFound("No pending invitation found");

  member.status = MEMBER_STATUS.ACTIVE;
  await member.save();
  return member;
}
