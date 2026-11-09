import { LoyaltyCard, LoyaltyProgram, Redemption, Stamp } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { bumpStat } from "@/services/stats.service";
import { grantWelcomeStamp } from "@/modules/stamps/stamps.service";
import { expireCardIfLapsed, stampExpiryDays, stampsExpireAt } from "./stampExpiry";
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

  const card = await LoyaltyCard.create({
    customerId,
    programId,
    businessId: program.businessId,
  });
  bumpStat(program.businessId, "newCards");
  await grantWelcomeStamp(customerId, card, program);
  return (await LoyaltyCard.findById(card._id)) ?? card;
}

export async function listCustomerCards(customerId: string) {
  const cards = await LoyaltyCard.find({ customerId })
    .sort({ lastStampAt: -1, createdAt: -1 })
    .populate("businessId", "name logo category")
    .populate("programId", "name requiredStamps branding status");

  return cards;
}

export async function getCardDetail(customerId: string, cardId: string) {
  const find = () =>
    LoyaltyCard.findOne({ _id: cardId, customerId })
      .populate("businessId", "name logo category")
      .populate("programId", "name description requiredStamps branding terms status settings");

  let card = await find();
  if (!card) throw ApiError.notFound("Loyalty card not found");

  // Show stamps that have expired as gone, even before the hourly job runs.
  const program = card.programId as unknown as { settings?: unknown } | null;
  if (program && (await expireCardIfLapsed(card._id, program))) card = (await find())!;
  const expiry = {
    stampExpiryDays: program ? stampExpiryDays(program) : null,
    stampsExpireAt: program ? stampsExpireAt(program, card) : null,
  };

  const [recentStamps, availableRewards] = await Promise.all([
    Stamp.find({ loyaltyCardId: card._id }).sort({ createdAt: -1 }).limit(10),
    // Past-date rewards are not offered even before the expiry job marks them.
    Redemption.find({
      loyaltyCardId: card._id,
      status: REDEMPTION_STATUS.PENDING,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).populate("rewardId"),
  ]);

  // Program caps are not the customer's business; only the expiry is shown.
  const shown = card.toJSON() as unknown as Record<string, unknown> & {
    programId?: Record<string, unknown>;
  };
  if (shown.programId) delete shown.programId.settings;
  return { card: { ...shown, ...expiry }, recentStamps, availableRewards };
}

export async function getCardForCustomerAndProgram(customerId: string, programId: string) {
  return LoyaltyCard.findOne({
    customerId,
    programId,
    status: { $ne: LOYALTY_CARD_STATUS.EXPIRED },
  });
}
