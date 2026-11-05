import mongoose from "mongoose";
import { Branch, Business, BusinessMember, LoyaltyProgram, NfcDevice, Reward } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { slugify, randomCode } from "@/utils/codes";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import {
  BUSINESS_ROLES,
  MEMBER_STATUS,
  BUSINESS_STATUS,
  DEVICE_STATUS,
} from "@taptapsell/constants";
import type { CreateBusinessInput, UpdateBusinessInput } from "@taptapsell/validation";

export async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "business";
  if (!(await Business.exists({ slug: base }))) return base;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${randomCode(4).toLowerCase()}`;
    if (!(await Business.exists({ slug: candidate }))) return candidate;
  }
  throw ApiError.conflict("Could not generate a unique business slug");
}

// The creating user becomes OWNER. Both writes must land together, otherwise a
// business could exist that nobody can administer.
export async function createBusiness(userId: string, input: CreateBusinessInput) {
  const slug = await generateUniqueSlug(input.name);
  const session = await mongoose.startSession();

  try {
    let business!: Awaited<ReturnType<typeof Business.create>>[number];

    await session.withTransaction(async () => {
      const [created] = await Business.create(
        [{ ...input, slug, status: BUSINESS_STATUS.PENDING }],
        { session },
      );

      await BusinessMember.create(
        [
          {
            userId,
            businessId: created._id,
            role: BUSINESS_ROLES.OWNER,
            status: MEMBER_STATUS.ACTIVE,
          },
        ],
        { session },
      );

      business = created;
    });

    await recordAudit({
      actorUserId: userId,
      actorRole: BUSINESS_ROLES.OWNER,
      businessId: business._id,
      action: AUDIT_ACTIONS.BUSINESS_CREATED,
      resourceType: "Business",
      resourceId: business._id,
    });

    return business;
  } finally {
    await session.endSession();
  }
}

export async function getBusinessById(businessId: string) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound("Business not found");
  return business;
}

export async function updateBusiness(
  businessId: string,
  actorUserId: string,
  input: UpdateBusinessInput,
) {
  const { staffDailyStampCap, stampApprovalAfter, ...profile } = input;
  const update: Record<string, unknown> = { ...profile };
  if (staffDailyStampCap !== undefined) update["settings.staffDailyStampCap"] = staffDailyStampCap;
  if (stampApprovalAfter !== undefined) {
    update["settings.stampApprovalAfter"] = stampApprovalAfter;
  }

  const business = await Business.findByIdAndUpdate(businessId, update, { new: true });
  if (!business) throw ApiError.notFound("Business not found");

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.BUSINESS_UPDATED,
    resourceType: "Business",
    resourceId: businessId,
    metadata: { fields: Object.keys(input) },
  });

  return business;
}

// Businesses the authenticated user belongs to, with their role in each —
// a user may be OWNER of one and MANAGER of another (§6).
export async function listMyBusinesses(userId: string) {
  const memberships = await BusinessMember.find({
    userId,
    status: MEMBER_STATUS.ACTIVE,
  }).populate("businessId");

  return memberships
    .filter((m) => m.businessId)
    .map((m) => ({
      business: m.businessId,
      role: m.role,
      // Empty means every branch.
      branchIds: m.branchIds.map((id) => id.toString()),
    }));
}

/** What is left to set up before customers can start collecting stamps. */
export async function getOnboardingStatus(businessId: string) {
  const [business, branches, programs, rewards, activeStampers, members] = await Promise.all([
    Business.findById(businessId).select("contact description"),
    Branch.countDocuments({ businessId }),
    LoyaltyProgram.countDocuments({ businessId }),
    Reward.countDocuments({ businessId }),
    NfcDevice.countDocuments({ businessId, status: DEVICE_STATUS.ACTIVE }),
    BusinessMember.countDocuments({ businessId }),
  ]);

  const steps = {
    profile: Boolean(business?.contact?.phone && business?.contact?.address),
    branch: branches > 0,
    program: programs > 0,
    reward: rewards > 0,
    stamper: activeStampers > 0,
    // Optional: a business may run with the owner alone.
    staff: members > 1,
  };
  const required = [steps.profile, steps.branch, steps.program, steps.reward, steps.stamper];

  return { steps, ready: required.every(Boolean) };
}

/** Staff invitations waiting for the signed-in user to accept or decline. */
export async function listMyPendingInvitations(userId: string) {
  const memberships = await BusinessMember.find({
    userId,
    status: MEMBER_STATUS.INVITED,
  }).populate<{ businessId: { _id: unknown; name: string; status: string } | null }>(
    "businessId",
    "name status",
  );

  return memberships
    .filter((m) => m.businessId)
    .map((m) => ({ business: m.businessId, role: m.role, invitedAt: m.createdAt }));
}

/**
 * Suspends or restores a business and its stampers. Shared by the platform
 * team (kind ADMIN) and the billing job (kind BILLING); callers audit.
 */
export async function applyBusinessStatus(
  businessId: string,
  status: "ACTIVE" | "SUSPENDED",
  suspension?: { kind: "ADMIN" | "BILLING"; reason?: string },
) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound("Business not found");

  business.status = status;
  business.suspension =
    status === BUSINESS_STATUS.SUSPENDED
      ? { kind: suspension?.kind ?? "ADMIN", reason: suspension?.reason, at: new Date() }
      : undefined;
  await business.save();

  // Suspension must also stop the hardware: an active stamper at a suspended
  // business would otherwise keep issuing valid stamps (§60).
  if (status === BUSINESS_STATUS.SUSPENDED) {
    await NfcDevice.updateMany(
      { businessId, status: DEVICE_STATUS.ACTIVE },
      { status: DEVICE_STATUS.SUSPENDED },
    );
  } else {
    await NfcDevice.updateMany(
      { businessId, status: DEVICE_STATUS.SUSPENDED },
      { status: DEVICE_STATUS.ACTIVE },
    );
  }
  return business;
}
