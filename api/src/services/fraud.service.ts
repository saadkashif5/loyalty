import type { Types } from "mongoose";
import { FraudFlag, Stamp } from "@/models";
import { logger } from "@/config/logger";
import { FRAUD_FLAG_STATUS, type FraudFlagType } from "@taptapsell/constants";

// A stamper issuing this many stamps this quickly is unusual even at rush hour.
const DEVICE_BURST_STAMPS = 40;
const DEVICE_BURST_WINDOW_MS = 10 * 60_000;

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
