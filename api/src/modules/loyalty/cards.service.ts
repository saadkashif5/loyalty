import { LoyaltyCard, LoyaltyProgram, Redemption, Stamp } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { assertWithinPlan } from "@/modules/billing/entitlements.service";
import { LOYALTY_CARD_STATUS, PROGRAM_STATUS, REDEMPTION_STATUS } from "@taptapsell/constants";

// Joining is idempotent: tapping "join" twice returns the same card rather than
// erroring, since the unique (customerId, programId) index would reject a second.
export async function joinProgram(customerId: string, programId: string) {
  const program = await LoyaltyProgram.findById(programId);
  if (!program) throw ApiError.notFound("Loyalty program not found");

  if (program.status !== PROGRAM_STATUS.ACTIVE) {
    throw ApiError.badRequest("This loyalty program is not currently active");
  }
  if (program.endDate && program.endDate < new Date()) {
    throw ApiError.badRequest("This loyalty program has ended");
  }

  const existing = await LoyaltyCard.findOne({ customerId, programId });
  if (existing) return existing;

  // Only someone new to this business counts against its customer limit.
  const businessId = program.businessId.toString();
  if (!(await LoyaltyCard.exists({ customerId, businessId }))) {
    await assertWithinPlan(businessId, "customers");
  }

  return LoyaltyCard.create({
    customerId,
    programId,
    businessId: program.businessId,
  });
}

export async function listCustomerCards(customerId: string) {
  const cards = await LoyaltyCard.find({ customerId })
    .sort({ lastStampAt: -1, createdAt: -1 })
    .populate("businessId", "name logo category")
    .populate("programId", "name requiredStamps branding status");

  return cards;
}

export async function getCardDetail(customerId: string, cardId: string) {
  const card = await LoyaltyCard.findOne({ _id: cardId, customerId })
    .populate("businessId", "name logo category")
    .populate("programId", "name description requiredStamps branding terms status");

  if (!card) throw ApiError.notFound("Loyalty card not found");

  const [recentStamps, availableRewards] = await Promise.all([
    Stamp.find({ loyaltyCardId: card._id }).sort({ createdAt: -1 }).limit(10),
    // Past-date rewards are not offered even before the expiry job marks them.
    Redemption.find({
      loyaltyCardId: card._id,
      status: REDEMPTION_STATUS.PENDING,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).populate("rewardId"),
  ]);

  return { card, recentStamps, availableRewards };
}

export async function getCardForCustomerAndProgram(customerId: string, programId: string) {
  return LoyaltyCard.findOne({
    customerId,
    programId,
    status: { $ne: LOYALTY_CARD_STATUS.EXPIRED },
  });
}
