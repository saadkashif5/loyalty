import { Branch } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import type { CreateBranchInput, UpdateBranchInput } from "@taptapsell/validation";

function toGeoPoint(location?: { lat: number; lng: number }) {
  if (!location) return undefined;
  return { type: "Point" as const, coordinates: [location.lng, location.lat] };
}

export async function createBranch(
  businessId: string,
  actorUserId: string,
  input: CreateBranchInput,
) {
  const branch = await Branch.create({
    businessId,
    name: input.name,
    address: input.address,
    contact: input.contact,
    location: toGeoPoint(input.location),
  });

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.BRANCH_CREATED,
    resourceType: "Branch",
    resourceId: branch._id,
  });

  return branch;
}

export async function listBranches(businessId: string) {
  return Branch.find({ businessId }).sort({ createdAt: 1 });
}

// Scoped by businessId as well as id so a member of business A can never reach
// a branch of business B by guessing an id (§29).
export async function getBranch(businessId: string, branchId: string) {
  const branch = await Branch.findOne({ _id: branchId, businessId });
  if (!branch) throw ApiError.notFound("Branch not found");
  return branch;
}

export async function updateBranch(
  businessId: string,
  branchId: string,
  actorUserId: string,
  input: UpdateBranchInput,
) {
  const { location, ...rest } = input;
  const branch = await Branch.findOneAndUpdate(
    { _id: branchId, businessId },
    { ...rest, ...(location ? { location: toGeoPoint(location) } : {}) },
    { new: true },
  );
  if (!branch) throw ApiError.notFound("Branch not found");

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.BRANCH_UPDATED,
    resourceType: "Branch",
    resourceId: branchId,
    metadata: { fields: Object.keys(input) },
  });

  return branch;
}
