import type { Types } from "mongoose";
import { DailyStat } from "@/models";
import { logger } from "@/config/logger";

export type StatField =
  "tapsVerified" | "tapsRejected" | "stamps" | "newCards" | "rewardsUnlocked" | "rewardsRedeemed";

const PAKISTAN_OFFSET_MS = 5 * 3_600_000;

/** yyyy-mm-dd for a moment, in Pakistan time. */
export function pakistanDay(at: Date = new Date()): string {
  return new Date(at.getTime() + PAKISTAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds to today's counter for a business. Never throws: a report must not break a stamp. */
export function bumpStat(
  businessId: string | Types.ObjectId,
  field: StatField,
  by = 1,
  at: Date = new Date(),
): void {
  if (by === 0) return;
  DailyStat.updateOne(
    { businessId, day: pakistanDay(at) },
    { $inc: { [field]: by } },
    { upsert: true },
  ).catch((err) => logger.warn({ err, field }, "Daily stat update failed"));
}
