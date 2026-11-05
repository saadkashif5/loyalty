import type { ClientSession, Types } from "mongoose";
import { LoyaltyCard } from "@/models";

export const DAY_MS = 86_400_000;

/** Days without a stamp after which a card's stamps expire, or null for never. */
export function stampExpiryDays(program: { settings?: unknown }): number | null {
  const days = (program.settings as { stampExpiryDays?: number | null } | undefined)
    ?.stampExpiryDays;
  return typeof days === "number" && days > 0 ? days : null;
}

/** When the stamps on a card expire, if the program expires them and it has any. */
export function stampsExpireAt(
  program: { settings?: unknown },
  card: { stampCount?: number; lastStampAt?: Date | null },
): Date | null {
  const days = stampExpiryDays(program);
  if (!days || !card.stampCount || !card.lastStampAt) return null;
  return new Date(card.lastStampAt.getTime() + days * DAY_MS);
}

/**
 * Empties a card whose stamps have expired. Returns how many stamps it lost
 * (0 if none). Conditional on the card still being lapsed, so it is safe
 * against a stamp or another run arriving at the same moment.
 */
export async function expireCardIfLapsed(
  cardId: Types.ObjectId | string,
  program: { settings?: unknown },
  now: Date = new Date(),
  session?: ClientSession,
): Promise<number> {
  const days = stampExpiryDays(program);
  if (!days) return 0;
  const before = await LoyaltyCard.findOneAndUpdate(
    {
      _id: cardId,
      stampCount: { $gt: 0 },
      lastStampAt: { $lte: new Date(now.getTime() - days * DAY_MS) },
    },
    { $set: { stampCount: 0 } },
    { new: false, session },
  );
  if (!before) return 0;
  await LoyaltyCard.updateOne(
    { _id: cardId },
    { $set: { lastExpiry: { at: now, stamps: before.stampCount } } },
    { session },
  );
  return before.stampCount;
}
