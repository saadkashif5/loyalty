import { LoyaltyProgram, Reward } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { PROGRAM_STATUS } from "@taptapsell/constants";
import type { CreateProgramInput, UpdateProgramInput } from "@taptapsell/validation";

export async function createProgram(
  businessId: string,
  actorUserId: string,
  input: CreateProgramInput,
) {
  const { minMinutesBetweenStamps, ...rest } = input;

  const program = await LoyaltyProgram.create({
    ...rest,
    businessId,
    settings: { minMinutesBetweenStamps },
  });

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.PROGRAM_CREATED,
    resourceType: "LoyaltyProgram",
    resourceId: program._id,
  });

  return program;
}

export async function listPrograms(businessId: string) {
  return LoyaltyProgram.find({ businessId }).sort({ createdAt: -1 });
}

export async function getProgram(businessId: string, programId: string) {
  const program = await LoyaltyProgram.findOne({ _id: programId, businessId }).populate("rewards");
  if (!program) throw ApiError.notFound("Loyalty program not found");
  return program;
}

export async function updateProgram(
  businessId: string,
  programId: string,
  actorUserId: string,
  input: UpdateProgramInput,
) {
  const { minMinutesBetweenStamps, ...rest } = input;
  const update: Record<string, unknown> = { ...rest };
  if (minMinutesBetweenStamps !== undefined) {
    update["settings.minMinutesBetweenStamps"] = minMinutesBetweenStamps;
  }

  const program = await LoyaltyProgram.findOneAndUpdate(
    { _id: programId, businessId },
    update,
    { new: true },
  );
  if (!program) throw ApiError.notFound("Loyalty program not found");

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.PROGRAM_UPDATED,
    resourceType: "LoyaltyProgram",
    resourceId: programId,
    metadata: { fields: Object.keys(input) },
  });

  return program;
}

// Programs a customer can browse/join — active, in-window, and belonging to an
// active business. Used by the customer app's discovery and join flows.
export async function listPublicPrograms(businessId: string) {
  const now = new Date();
  return LoyaltyProgram.find({
    businessId,
    status: PROGRAM_STATUS.ACTIVE,
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gt: now } }],
  }).populate({ path: "rewards", match: { status: "ACTIVE" } });
}

export async function attachRewardToProgram(programId: string, rewardId: string) {
  await LoyaltyProgram.updateOne({ _id: programId }, { $addToSet: { rewards: rewardId } });
}

export async function detachRewardFromProgram(programId: string, rewardId: string) {
  await LoyaltyProgram.updateOne({ _id: programId }, { $pull: { rewards: rewardId } });
}

export async function assertProgramBelongsToBusiness(programId: string, businessId: string) {
  const exists = await LoyaltyProgram.exists({ _id: programId, businessId });
  if (!exists) throw ApiError.notFound("Loyalty program not found");
}

export async function findRewardsForProgram(programId: string) {
  return Reward.find({ programId, status: "ACTIVE" });
}
