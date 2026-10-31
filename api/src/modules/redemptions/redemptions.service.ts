import { LoyaltyCard, Redemption, Reward } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { generateRedemptionCode } from "@/utils/codes";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { queueNotification } from "@/services/notification.service";
import { REDEMPTION_STATUS } from "@taptapsell/constants";

export async function listCustomerRedemptions(customerId: string) {
  return Redemption.find({ customerId })
    .sort({ createdAt: -1 })
    .populate("rewardId", "name description type value terms expiresAt")
    .populate("businessId", "name logo");
}

export async function getRedemption(customerId: string, redemptionId: string) {
  const redemption = await Redemption.findOne({ _id: redemptionId, customerId })
    .populate("rewardId")
    .populate("businessId", "name logo");
  if (!redemption) throw ApiError.notFound("Reward not found");
  return redemption;
}

/**
 * Manual redemption request for a reward the customer has already met the
 * requirements for. Most redemptions are created automatically by the stamp
 * transaction; this covers rewards claimed outside that path.
 */
export async function requestRedemption(
  customerId: string,
  input: { rewardId: string; loyaltyCardId: string },
) {
  const card = await LoyaltyCard.findOne({ _id: input.loyaltyCardId, customerId });
  if (!card) throw ApiError.notFound("Loyalty card not found");

  const reward = await Reward.findOne({
    _id: input.rewardId,
    programId: card.programId,
    status: "ACTIVE",
  });
  if (!reward) throw ApiError.notFound("Reward not found");

  if (reward.expiresAt && reward.expiresAt < new Date()) {
    throw ApiError.badRequest("This reward has expired");
  }
  if (card.stampCount < reward.requiredStamps) {
    throw ApiError.badRequest("You have not collected enough stamps for this reward yet");
  }

  const alreadyIssued = await Redemption.countDocuments({
    rewardId: reward._id,
    loyaltyCardId: card._id,
    status: { $in: [REDEMPTION_STATUS.PENDING, REDEMPTION_STATUS.REDEEMED] },
  });
  if (alreadyIssued >= (reward.redemptionLimit ?? 1)) {
    throw ApiError.conflict("This reward has already been claimed");
  }

  const redemption = await Redemption.create({
    rewardId: reward._id,
    customerId,
    loyaltyCardId: card._id,
    businessId: card.businessId,
    redemptionCode: generateRedemptionCode(),
    status: REDEMPTION_STATUS.PENDING,
  });

  await recordAudit({
    actorUserId: customerId,
    businessId: card.businessId,
    action: AUDIT_ACTIONS.REDEMPTION_CREATED,
    resourceType: "Redemption",
    resourceId: redemption._id,
  });

  return redemption;
}

/**
 * Staff-side validation. The status transition is a conditional update rather
 * than a read-then-write, so two staff scanning the same code concurrently can
 * never both mark it redeemed (§17.2).
 */
export async function validateRedemption(params: {
  businessId: string;
  staffUserId: string;
  redemptionCode: string;
  branchId?: string;
}) {
  const redemption = await Redemption.findOneAndUpdate(
    {
      redemptionCode: params.redemptionCode,
      businessId: params.businessId,
      status: REDEMPTION_STATUS.PENDING,
    },
    {
      $set: {
        status: REDEMPTION_STATUS.REDEEMED,
        redeemedAt: new Date(),
        redeemedBy: params.staffUserId,
        ...(params.branchId ? { branchId: params.branchId } : {}),
      },
    },
    { new: true },
  ).populate("rewardId", "name description");

  if (!redemption) {
    // Covers unknown code, another business's code, and an already-redeemed code.
    const existing = await Redemption.findOne({
      redemptionCode: params.redemptionCode,
      businessId: params.businessId,
    });

    if (existing?.status === REDEMPTION_STATUS.REDEEMED) {
      throw ApiError.conflict("This reward has already been redeemed");
    }
    throw ApiError.notFound("No valid reward found for this code");
  }

  await recordAudit({
    actorUserId: params.staffUserId,
    businessId: params.businessId,
    action: AUDIT_ACTIONS.REDEMPTION_COMPLETED,
    resourceType: "Redemption",
    resourceId: redemption._id,
    metadata: { customerId: redemption.customerId.toString() },
  });

  await queueNotification({
    userId: redemption.customerId.toString(),
    type: "REWARD_REDEEMED",
    title: "Reward redeemed",
    body: "Your reward has been redeemed. Enjoy!",
    data: { redemptionId: redemption._id.toString() },
  });

  return redemption;
}

export async function listBusinessRedemptions(
  businessId: string,
  options: { page: number; limit: number; branchIds?: string[] },
) {
  const filter: Record<string, unknown> = { businessId };
  if (options.branchIds?.length) filter.branchId = { $in: options.branchIds };

  const [items, total] = await Promise.all([
    Redemption.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate("rewardId", "name")
      .populate("customerId", "name email"),
    Redemption.countDocuments(filter),
  ]);

  return { items, total };
}
