import { Reward } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import {
  assertProgramBelongsToBusiness,
  assertRewardFitsProgram,
  attachRewardToProgram,
  detachRewardFromProgram,
} from "@/modules/loyalty/programs.service";
import type { CreateRewardInput, UpdateRewardInput } from "@taptapsell/validation";

export async function createReward(
  businessId: string,
  actorUserId: string,
  input: CreateRewardInput,
) {
  const program = await assertProgramBelongsToBusiness(input.programId, businessId);
  assertRewardFitsProgram(input.requiredStamps, program.requiredStamps);

  const reward = await Reward.create({ ...input, businessId });
  await attachRewardToProgram(input.programId, reward._id.toString());

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.REWARD_CREATED,
    resourceType: "Reward",
    resourceId: reward._id,
  });

  return reward;
}

export async function listRewards(businessId: string, programId?: string) {
  return Reward.find({ businessId, ...(programId ? { programId } : {}) }).sort({ createdAt: -1 });
}

export async function updateReward(
  businessId: string,
  rewardId: string,
  actorUserId: string,
  input: UpdateRewardInput,
) {
  if (input.requiredStamps !== undefined) {
    const existing = await Reward.findOne({ _id: rewardId, businessId }).select("programId");
    if (!existing) throw ApiError.notFound("Reward not found");
    const program = await assertProgramBelongsToBusiness(existing.programId.toString(), businessId);
    assertRewardFitsProgram(input.requiredStamps, program.requiredStamps);
  }

  const reward = await Reward.findOneAndUpdate({ _id: rewardId, businessId }, input, { new: true });
  if (!reward) throw ApiError.notFound("Reward not found");

  if (input.status === "INACTIVE") {
    await detachRewardFromProgram(reward.programId.toString(), rewardId);
  }

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.REWARD_UPDATED,
    resourceType: "Reward",
    resourceId: rewardId,
    metadata: { fields: Object.keys(input) },
  });

  return reward;
}
