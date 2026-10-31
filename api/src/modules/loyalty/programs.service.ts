import { LoyaltyProgram, Reward } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { assertWithinPlan } from "@/modules/billing/entitlements.service";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { PROGRAM_STATUS } from "@taptapsell/constants";
import type { CreateProgramInput, UpdateProgramInput } from "@taptapsell/validation";

export async function createProgram(
  businessId: string,
  actorUserId: string,
  input: CreateProgramInput,
) {
  await assertWithinPlan(businessId, "programs");
  const { minMinutesBetweenStamps, maxStampsPerDay, ...rest } = input;

  const program = await LoyaltyProgram.create({
    ...rest,
    businessId,
    settings: { minMinutesBetweenStamps, maxStampsPerDay },
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
  const { minMinutesBetweenStamps, maxStampsPerDay, ...rest } = input;

  // Switching a paused program back on counts against the plan like a new one.
  if (input.status === PROGRAM_STATUS.ACTIVE) {
    const current = await LoyaltyProgram.findOne({ _id: programId, businessId }).select("status");
    if (current && current.status !== PROGRAM_STATUS.ACTIVE) {
      await assertWithinPlan(businessId, "programs");
    }
  }

  if (input.requiredStamps !== undefined) {
    const largest = await Reward.findOne({ programId, businessId, status: "ACTIVE" })
      .sort({ requiredStamps: -1 })
      .select("requiredStamps");
    if (largest && largest.requiredStamps > input.requiredStamps) {
      throw ApiError.badRequest(
        `An active reward needs ${largest.requiredStamps} stamps. Lower or deactivate it first.`,
      );
    }
  }

  const update: Record<string, unknown> = { ...rest };
  if (minMinutesBetweenStamps !== undefined) {
    update["settings.minMinutesBetweenStamps"] = minMinutesBetweenStamps;
  }
  if (maxStampsPerDay !== undefined) {
    update["settings.maxStampsPerDay"] = maxStampsPerDay;
  }

  const program = await LoyaltyProgram.findOneAndUpdate({ _id: programId, businessId }, update, {
    new: true,
  });
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
  const program = await LoyaltyProgram.findOne({ _id: programId, businessId }).select(
    "requiredStamps",
  );
  if (!program) throw ApiError.notFound("Loyalty program not found");
  return program;
}

// A card resets when it reaches the program's stamp count, so a reward that
// needs more stamps than that could never be unlocked.
export function assertRewardFitsProgram(rewardStamps: number, programStamps: number) {
  if (rewardStamps > programStamps) {
    throw ApiError.badRequest(
      `A reward cannot need more stamps than the program's card holds (${programStamps}).`,
    );
  }
}

export async function findRewardsForProgram(programId: string) {
  return Reward.find({ programId, status: "ACTIVE" });
}
