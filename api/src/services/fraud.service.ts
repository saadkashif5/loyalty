import type { Types } from "mongoose";
import { Branch, FraudFlag, Stamp } from "@/models";
import { logger } from "@/config/logger";
import { FRAUD_FLAG_STATUS, type FraudFlagType } from "@taptapsell/constants";

// A stamper issuing this many stamps this quickly is unusual even at rush hour.
const DEVICE_BURST_STAMPS = 40;
const DEVICE_BURST_WINDOW_MS = 10 * 60_000;

// This many first stamps by brand-new accounts at one stamper within an hour
// suggests accounts made to farm rewards.
const NEW_ACCOUNT_BURST = 10;
const NEW_ACCOUNT_WINDOW_MS = 60 * 60_000;
/** Staff opening up or closing late are not flagged. */
const HOURS_GRACE_MINUTES = 30;
const PAKISTAN_OFFSET_MS = 5 * 3_600_000;

type Id = string | Types.ObjectId;

interface FlagInput {
  businessId: Id;
  type: FraudFlagType;
  severity?: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  deviceId?: Id;
  staffUserId?: Id;
  details?: Record<string, unknown>;
}

/**
 * Records something suspicious for the owner to review. An open flag for the
 * same problem (type + stamper/staff member) is counted up rather than
 * duplicated, so a noisy problem stays one line on the Alerts page.
 * Never throws: a failed flag must not break the stamp that triggered it.
 */
export async function raiseFlag(input: FlagInput): Promise<void> {
  try {
    const match = {
      businessId: input.businessId,
      type: input.type,
      status: FRAUD_FLAG_STATUS.OPEN,
      deviceId: input.deviceId ?? null,
      staffUserId: input.staffUserId ?? null,
    };

    const existing = await FraudFlag.findOneAndUpdate(
      match,
      { $inc: { occurrences: 1 }, $set: { lastSeenAt: new Date(), details: input.details ?? {} } },
      { new: true },
    );
    if (existing) return;

    await FraudFlag.create({
      ...match,
      severity: input.severity ?? "MEDIUM",
      message: input.message,
      details: input.details ?? {},
    });
  } catch (err) {
    logger.error({ err, type: input.type }, "Failed to raise fraud flag");
  }
}

/** Checked after each tap stamp: many stamps from one stamper in a short time. */
export async function checkDeviceBurst(businessId: Id, deviceId: Id): Promise<void> {
  try {
    const since = new Date(Date.now() - DEVICE_BURST_WINDOW_MS);
    const recent = await Stamp.countDocuments({ deviceId, createdAt: { $gte: since } });
    if (recent < DEVICE_BURST_STAMPS) return;

    await raiseFlag({
      businessId,
      type: "DEVICE_BURST",
      severity: "HIGH",
      message: `${recent} stamps from one stamper in the last 10 minutes.`,
      deviceId,
      details: { stampsInWindow: recent, windowMinutes: DEVICE_BURST_WINDOW_MS / 60_000 },
    });
  } catch (err) {
    logger.error({ err }, "Device burst check failed");
  }
}

export interface OpeningHours {
  day: number;
  open: string;
  close: string;
}

const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/**
 * Whether `at` falls outside every opening of the week, with some grace either
 * side. Hours are Pakistan time; a close before the open runs past midnight
 * into the next day. No hours at all means nothing is outside.
 */
export function isOutsideOpeningHours(hours: OpeningHours[] | undefined | null, at: Date): boolean {
  if (!hours || hours.length === 0) return false;
  const local = new Date(at.getTime() + PAKISTAN_OFFSET_MS);
  const week = 7 * 1440;
  const now = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();

  return !hours.some((h) => {
    const start = h.day * 1440 + minutes(h.open) - HOURS_GRACE_MINUTES;
    let length = minutes(h.close) - minutes(h.open);
    if (length <= 0) length += 1440; // past midnight
    const end = start + length + 2 * HOURS_GRACE_MINUTES;
    // The week wraps: Saturday night runs into Sunday morning.
    return [now, now + week, now - week].some((t) => t >= start && t < end);
  });
}

/** Checked after each stamp: given while the branch is closed. */
export async function checkOutsideHours(input: {
  businessId: Id;
  branchId: Id;
  deviceId?: Id;
  staffUserId?: Id;
  at?: Date;
}): Promise<void> {
  try {
    const branch = await Branch.findById(input.branchId).select("name openingHours");
    const at = input.at ?? new Date();
    const hours = (branch?.openingHours ?? []) as OpeningHours[];
    if (!branch || !isOutsideOpeningHours(hours, at)) return;

    const time = at.toLocaleString("en-PK", {
      timeZone: "Asia/Karachi",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    await raiseFlag({
      businessId: input.businessId,
      type: "OUTSIDE_HOURS",
      message: `A stamp was given at ${branch.name} while it was closed (${time}).`,
      deviceId: input.deviceId,
      staffUserId: input.staffUserId,
      details: { branchId: String(input.branchId), at },
    });
  } catch (err) {
    logger.error({ err }, "Opening hours check failed");
  }
}

/** Checked after a brand-new account's first stamp at a stamper. */
export async function checkNewAccountBurst(businessId: Id, deviceId: Id): Promise<void> {
  try {
    const since = new Date(Date.now() - NEW_ACCOUNT_WINDOW_MS);
    const recent = await Stamp.countDocuments({
      deviceId,
      createdAt: { $gte: since },
      "metadata.newCustomer": true,
    });
    if (recent < NEW_ACCOUNT_BURST) return;

    await raiseFlag({
      businessId,
      type: "NEW_ACCOUNT_BURST",
      severity: "HIGH",
      message: `${recent} brand-new accounts got their first stamp from one stamper in the last hour.`,
      deviceId,
      details: { newAccountsInWindow: recent, windowMinutes: NEW_ACCOUNT_WINDOW_MS / 60_000 },
    });
  } catch (err) {
    logger.error({ err }, "New account burst check failed");
  }
}
