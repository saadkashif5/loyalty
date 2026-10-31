import { CounterCode, LoyaltyCard, User } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { randomCode } from "@/utils/codes";
import { maskEmail, maskPhone } from "@/modules/customers/customers.service";
import { LOYALTY_CARD_STATUS } from "@taptapsell/constants";

const CODE_TTL_MS = 3 * 60_000;
// A code with less time left than this is replaced, so staff never get one that dies mid-scan.
const MIN_REMAINING_MS = 60_000;
const DUPLICATE_KEY_ERROR = 11000;

/**
 * The code a customer's card shows at the counter. Reused while it has time
 * left, so a card left open on screen does not create a new record every poll.
 */
export async function issueCounterCode(customerId: string, cardId: string) {
  const card = await LoyaltyCard.findOne({
    _id: cardId,
    customerId,
    status: LOYALTY_CARD_STATUS.ACTIVE,
  }).select("businessId");
  if (!card) throw ApiError.notFound("Loyalty card not found");

  const current = await CounterCode.findOne({
    loyaltyCardId: card._id,
    consumedAt: null,
    expiresAt: { $gt: new Date(Date.now() + MIN_REMAINING_MS) },
  }).sort({ createdAt: -1 });
  if (current) return { code: current.code, expiresAt: current.expiresAt };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await CounterCode.create({
        code: randomCode(8),
        loyaltyCardId: card._id,
        customerId,
        businessId: card.businessId,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });
      return { code: created.code, expiresAt: created.expiresAt };
    } catch (err) {
      // 32^8 codes; a collision is rare but possible — just draw again.
      if ((err as { code?: number }).code !== DUPLICATE_KEY_ERROR) throw err;
    }
  }
  throw ApiError.internal();
}

/** What staff see after scanning, to confirm the right customer before stamping. */
export async function lookupCounterCode(businessId: string, code: string) {
  const counterCode = await CounterCode.findOne({
    code,
    businessId,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!counterCode) {
    throw new ApiError(
      404,
      "COUNTER_CODE_INVALID",
      "That code is not valid any more. Ask the customer to open their card again.",
    );
  }

  const [card, customer] = await Promise.all([
    LoyaltyCard.findById(counterCode.loyaltyCardId).populate<{
      programId: { name: string; requiredStamps: number } | null;
    }>("programId", "name requiredStamps"),
    User.findById(counterCode.customerId).select("name phone email"),
  ]);

  return {
    customer: {
      name: customer?.name ?? "Customer",
      phone: maskPhone(customer?.phone),
      email: maskEmail(customer?.email),
    },
    card: {
      id: card?._id.toString(),
      program: card?.programId?.name,
      stampCount: card?.stampCount ?? 0,
      requiredStamps: card?.programId?.requiredStamps ?? 0,
    },
    expiresAt: counterCode.expiresAt,
  };
}
