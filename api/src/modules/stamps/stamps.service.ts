import mongoose from "mongoose";
import {
  LoyaltyCard,
  LoyaltyProgram,
  Redemption,
  Reward,
  Stamp,
} from "@/models";
import { ApiError } from "@/utils/ApiError";
import { generateRedemptionCode } from "@/utils/codes";
import { resolveDeviceForStamping } from "@/modules/devices/devices.service";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { queueNotification } from "@/services/notification.service";
import {
  LOYALTY_CARD_STATUS,
  PROGRAM_STATUS,
  REDEMPTION_STATUS,
  STAMP_SOURCE,
  type StampSource,
} from "@taptapsell/constants";

const DUPLICATE_KEY_ERROR = 11000;

interface StampRequest {
  customerId: string;
  deviceIdentifier: string;
  source: StampSource;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface StampResult {
  stampId: string;
  alreadyRecorded: boolean;
  card: {
    id: string;
    stampCount: number;
    requiredStamps: number;
  };
  unlockedReward: {
    redemptionId: string;
    redemptionCode: string;
    rewardName: string;
  } | null;
}

/**
 * Finds the active program at this branch that the customer already holds a card for.
 * Enrolment is never implicit — an unenrolled customer gets a distinct error so the
 * app can offer to join rather than silently creating a card (§32).
 */
async function resolveCardForDevice(customerId: string, businessId: string, branchId: string) {
  const now = new Date();

  const programs = await LoyaltyProgram.find({
    businessId,
    status: PROGRAM_STATUS.ACTIVE,
    startDate: { $lte: now },
    $and: [
      { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gt: now } }] },
      // Empty branches array means the program runs at every branch.
      { $or: [{ branches: { $size: 0 } }, { branches: branchId }] },
    ],
  });

  if (programs.length === 0) {
    throw ApiError.badRequest("This business has no active loyalty program at this location.");
  }

  const card = await LoyaltyCard.findOne({
    customerId,
    programId: { $in: programs.map((p) => p._id) },
    status: LOYALTY_CARD_STATUS.ACTIVE,
  });

  if (!card) {
    throw new ApiError(
      409,
      "NOT_ENROLLED",
      "You have not joined this loyalty program yet.",
      { programs: programs.map((p) => ({ id: p._id.toString(), name: p.name })) },
    );
  }

  const program = programs.find((p) => p._id.toString() === card.programId.toString())!;
  return { card, program };
}

/** Rejects rapid repeat taps on the same card (§14). */
function assertStampCooldown(lastStampAt: Date | undefined | null, minMinutes: number) {
  if (!lastStampAt || minMinutes <= 0) return;

  const elapsedMs = Date.now() - lastStampAt.getTime();
  if (elapsedMs < minMinutes * 60_000) {
    const waitMinutes = Math.ceil((minMinutes * 60_000 - elapsedMs) / 60_000);
    throw new ApiError(
      429,
      "STAMP_COOLDOWN",
      `You have already collected a stamp here recently. Please try again in ${waitMinutes} minute(s).`,
    );
  }
}

async function buildResultForExistingStamp(
  customerId: string,
  idempotencyKey: string,
): Promise<StampResult> {
  const stamp = await Stamp.findOne({ customerId, idempotencyKey });
  if (!stamp) throw ApiError.internal();

  const card = await LoyaltyCard.findById(stamp.loyaltyCardId);
  const program = await LoyaltyProgram.findById(stamp.programId).select("requiredStamps");

  return {
    stampId: stamp._id.toString(),
    alreadyRecorded: true,
    card: {
      id: stamp.loyaltyCardId.toString(),
      stampCount: card?.stampCount ?? 0,
      requiredStamps: program?.requiredStamps ?? 0,
    },
    unlockedReward: null,
  };
}

/**
 * The core loyalty transaction (§28). Stamp creation, progress increment and
 * reward unlock all commit together or not at all, so the system can never end
 * up with a stamp that did not count or a reward granted twice.
 */
export async function createStamp(request: StampRequest): Promise<StampResult> {
  const device = await resolveDeviceForStamping(request.deviceIdentifier);
  const { card, program } = await resolveCardForDevice(
    request.customerId,
    device.businessId,
    device.branchId,
  );

  const minMinutes = (program.settings as { minMinutesBetweenStamps?: number })
    ?.minMinutesBetweenStamps ?? 5;
  assertStampCooldown(card.lastStampAt, minMinutes);

  const session = await mongoose.startSession();
  let result: StampResult;

  try {
    result = await session.withTransaction(async (): Promise<StampResult> => {
      const [stamp] = await Stamp.create(
        [
          {
            customerId: request.customerId,
            loyaltyCardId: card._id,
            programId: program._id,
            businessId: device.businessId,
            branchId: device.branchId,
            deviceId: device.deviceId,
            source: request.source,
            idempotencyKey: request.idempotencyKey,
            metadata: request.metadata ?? {},
          },
        ],
        { session },
      );

      const updatedCard = await LoyaltyCard.findOneAndUpdate(
        { _id: card._id },
        { $inc: { stampCount: 1 }, $set: { lastStampAt: new Date() } },
        { new: true, session },
      );
      if (!updatedCard) throw ApiError.internal();

      let unlockedReward: StampResult["unlockedReward"] = null;

      if (updatedCard.stampCount >= program.requiredStamps) {
        const reward = await Reward.findOne({
          programId: program._id,
          status: "ACTIVE",
          requiredStamps: { $lte: updatedCard.stampCount },
        })
          .sort({ requiredStamps: -1 })
          .session(session);

        if (reward) {
          const [redemption] = await Redemption.create(
            [
              {
                rewardId: reward._id,
                customerId: request.customerId,
                loyaltyCardId: updatedCard._id,
                businessId: device.businessId,
                branchId: device.branchId,
                redemptionCode: generateRedemptionCode(),
                status: REDEMPTION_STATUS.PENDING,
              },
            ],
            { session },
          );

          // Progress resets so the card keeps working for the next reward cycle.
          updatedCard.stampCount = 0;
          await updatedCard.save({ session });

          unlockedReward = {
            redemptionId: redemption._id.toString(),
            redemptionCode: redemption.redemptionCode,
            rewardName: reward.name,
          };
        }
      }

      return {
        stampId: stamp._id.toString(),
        alreadyRecorded: false,
        card: {
          id: updatedCard._id.toString(),
          stampCount: updatedCard.stampCount,
          requiredStamps: program.requiredStamps,
        },
        unlockedReward,
      };
    });
  } catch (err) {
    // A retried request carrying the same idempotency key is not an error —
    // it returns the original outcome instead of creating a second stamp (§28).
    if (
      err instanceof mongoose.mongo.MongoServerError &&
      err.code === DUPLICATE_KEY_ERROR
    ) {
      return buildResultForExistingStamp(request.customerId, request.idempotencyKey);
    }
    throw err;
  } finally {
    await session.endSession();
  }

  await queueNotification({
    userId: request.customerId,
    type: result.unlockedReward ? "REWARD_UNLOCKED" : "STAMP_ADDED",
    title: result.unlockedReward ? "Reward unlocked!" : "Stamp added",
    body: result.unlockedReward
      ? `You have earned: ${result.unlockedReward.rewardName}`
      : `${result.card.stampCount} of ${result.card.requiredStamps} stamps collected.`,
    data: { loyaltyCardId: result.card.id },
  });

  return result;
}

/** Manual stamp issuance by business staff — always audited (§13, §37). */
export async function createManualStamp(params: {
  businessId: string;
  actorUserId: string;
  customerId: string;
  loyaltyCardId: string;
  branchId: string;
  idempotencyKey: string;
}) {
  const card = await LoyaltyCard.findOne({
    _id: params.loyaltyCardId,
    customerId: params.customerId,
    businessId: params.businessId,
  });
  if (!card) throw ApiError.notFound("Loyalty card not found for this business");

  const stamp = await Stamp.create({
    customerId: params.customerId,
    loyaltyCardId: card._id,
    programId: card.programId,
    businessId: params.businessId,
    branchId: params.branchId,
    source: STAMP_SOURCE.ADMIN,
    idempotencyKey: params.idempotencyKey,
  });

  await LoyaltyCard.updateOne(
    { _id: card._id },
    { $inc: { stampCount: 1 }, $set: { lastStampAt: new Date() } },
  );

  await recordAudit({
    actorUserId: params.actorUserId,
    businessId: params.businessId,
    action: AUDIT_ACTIONS.STAMP_ISSUED_MANUAL,
    resourceType: "Stamp",
    resourceId: stamp._id,
    metadata: { customerId: params.customerId, loyaltyCardId: params.loyaltyCardId },
  });

  return stamp;
}

export async function listCustomerStamps(customerId: string, limit = 50) {
  return Stamp.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("businessId", "name logo");
}

export async function listBusinessStamps(
  businessId: string,
  options: { page: number; limit: number; branchId?: string },
) {
  const filter: Record<string, unknown> = { businessId };
  if (options.branchId) filter.branchId = options.branchId;

  const [items, total] = await Promise.all([
    Stamp.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate("customerId", "name email"),
    Stamp.countDocuments(filter),
  ]);

  return { items, total };
}
