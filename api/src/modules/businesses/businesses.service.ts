import mongoose from "mongoose";
import { Business, BusinessMember } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { slugify, randomCode } from "@/utils/codes";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { BUSINESS_ROLES, MEMBER_STATUS, BUSINESS_STATUS } from "@taptapsell/constants";
import type { CreateBusinessInput, UpdateBusinessInput } from "@taptapsell/validation";

async function generateUniqueSlug(name: string): Promise<string> {
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
  const business = await Business.findByIdAndUpdate(businessId, input, { new: true });
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
    .map((m) => ({ business: m.businessId, role: m.role }));
}
