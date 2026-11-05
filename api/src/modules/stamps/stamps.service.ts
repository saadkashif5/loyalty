import { afterCursor, sortFor, toPage, type CursorRequest } from "@/utils/cursor";
import mongoose, { type ClientSession, type Types } from "mongoose";
import {
  Branch,
  Business,
  CounterCode,
  LoyaltyCard,
  LoyaltyProgram,
  Redemption,
  Reward,
  Stamp,
  User,
} from "@/models";
import { expireCardIfLapsed } from "@/modules/loyalty/stampExpiry";
import { ApiError } from "@/utils/ApiError";
import { generateRedemptionCode } from "@/utils/codes";
import { resolveDeviceForStamping } from "@/modules/devices/devices.service";
import { consumeTap, findUsableTap } from "@/modules/taps/taps.service";
import { logger } from "@/config/logger";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { queueNotification } from "@/services/notification.service";
import {
  checkDeviceBurst,
  checkNewAccountBurst,
  checkOutsideHours,
  raiseFlag,
} from "@/services/fraud.service";
import {
  LOYALTY_CARD_STATUS,
  PROGRAM_STATUS,
  REDEMPTION_STATUS,
  REWARD_STATUS,
  STAMP_SOURCE,
  TAG_TYPE,
  type StampSource,
} from "@taptapsell/constants";

const DUPLICATE_KEY_ERROR = 11000;

type StampRequest = {
  customerId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
} & (
  | { tapToken: string }
  // Legacy path, accepted only for STATIC stampers.
  | { deviceIdentifier: string; source: StampSource }
);

interface UnlockedReward {
  redemptionId: string;
  redemptionCode: string;
  rewardName: string;
}

export interface StampResult {
  stampId: string;
  alreadyRecorded: boolean;
  card: {
    id: string;
    stampCount: number;
    requiredStamps: number;
  };
  /** First reward unlocked by this stamp; kept for clients that show one. */
  unlockedReward: UnlockedReward | null;
  /** Every reward unlocked by this stamp (several tiers can share a threshold). */
  unlockedRewards: UnlockedReward[];
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
    throw new ApiError(409, "NOT_ENROLLED", "You have not joined this loyalty program yet.", {
      programs: programs.map((p) => ({ id: p._id.toString(), name: p.name })),
    });
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
    unlockedRewards: [],
  };
}

interface StampContext {
  customerId: string;
  cardId: Types.ObjectId;
  program: { _id: Types.ObjectId; requiredStamps: number; settings?: unknown };
  businessId: string;
  branchId: string;
  deviceId?: string;
  /** Staff member who added the stamp (counter and manual stamps). */
  issuedBy?: string;
  source: StampSource;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
}

const DAY_MS = 86_400_000;
// Pakistan Standard Time, UTC+5 all year (no daylight saving).
const PAKISTAN_OFFSET_MS = 5 * 3_600_000;

/** Midnight in Pakistan, as a UTC instant: daily caps reset at local midnight. */
export function startOfPakistanDay(now: number = Date.now()): Date {
  const local = now + PAKISTAN_OFFSET_MS;
  return new Date(local - (local % DAY_MS) - PAKISTAN_OFFSET_MS);
}

/**
 * Writes one stamp and everything it causes, inside the caller's transaction
 * (§28). Every active reward whose threshold the card reaches is unlocked, so a
 * program can offer tiers (e.g. a small reward at 5 stamps and a bigger one at
 * 10). The program's stamp count is the length of one cycle: reaching it
 * resets the card for the next cycle.
 */
async function applyStamp(ctx: StampContext, session: ClientSession): Promise<StampResult> {
  const [stamp] = await Stamp.create(
    [
      {
        customerId: ctx.customerId,
        loyaltyCardId: ctx.cardId,
        programId: ctx.program._id,
        businessId: ctx.businessId,
        branchId: ctx.branchId,
        deviceId: ctx.deviceId,
        issuedBy: ctx.issuedBy,
        source: ctx.source,
        idempotencyKey: ctx.idempotencyKey,
        metadata: ctx.metadata,
      },
    ],
    { session },
  );

  // A card idle past the program's stamp expiry starts again from this stamp,
  // even if the hourly expiry job has not reached it yet.
  await expireCardIfLapsed(ctx.cardId, ctx.program, new Date(), session);

  const updatedCard = await LoyaltyCard.findOneAndUpdate(
    { _id: ctx.cardId },
    { $inc: { stampCount: 1 }, $set: { lastStampAt: new Date() } },
    { new: true, session },
  );
  if (!updatedCard) throw ApiError.internal();

  const rewards = await Reward.find({
    programId: ctx.program._id,
    status: REWARD_STATUS.ACTIVE,
    requiredStamps: updatedCard.stampCount,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).session(session);

  const unlockedRewards: UnlockedReward[] = [];
  for (const reward of rewards) {
    const [redemption] = await Redemption.create(
      [
        {
          rewardId: reward._id,
          customerId: ctx.customerId,
          loyaltyCardId: updatedCard._id,
          businessId: ctx.businessId,
          branchId: ctx.branchId,
          redemptionCode: generateRedemptionCode(),
          status: REDEMPTION_STATUS.PENDING,
          expiresAt: reward.validForDays
            ? new Date(Date.now() + reward.validForDays * DAY_MS)
            : null,
        },
      ],
      { session },
    );

    unlockedRewards.push({
      redemptionId: redemption._id.toString(),
      redemptionCode: redemption.redemptionCode,
      rewardName: reward.name,
    });
  }

  if (updatedCard.stampCount >= ctx.program.requiredStamps) {
    updatedCard.stampCount = 0;
    await updatedCard.save({ session });
  }

  return {
    stampId: stamp._id.toString(),
    alreadyRecorded: false,
    card: {
      id: updatedCard._id.toString(),
      stampCount: updatedCard.stampCount,
      requiredStamps: ctx.program.requiredStamps,
    },
    unlockedReward: unlockedRewards[0] ?? null,
    unlockedRewards,
  };
}

/** Runs applyStamp in a transaction; a duplicate idempotency key returns the original stamp. */
async function commitStamp(
  ctx: StampContext,
  beforeWrite?: (session: ClientSession) => Promise<void>,
): Promise<StampResult> {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      if (beforeWrite) await beforeWrite(session);
      return applyStamp(ctx, session);
    });
  } catch (err) {
    // A retried request carrying the same idempotency key is not an error —
    // it returns the original outcome instead of creating a second stamp (§28).
    if (err instanceof mongoose.mongo.MongoServerError && err.code === DUPLICATE_KEY_ERROR) {
      return buildResultForExistingStamp(ctx.customerId, ctx.idempotencyKey);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

async function notifyStamp(customerId: string, result: StampResult) {
  if (result.alreadyRecorded) return;

  const unlocked = result.unlockedRewards.length > 0;
  await queueNotification({
    userId: customerId,
    type: unlocked ? "REWARD_UNLOCKED" : "STAMP_ADDED",
    title: unlocked ? "Reward unlocked!" : "Stamp added",
    body: unlocked
      ? `You have earned: ${result.unlockedRewards.map((r) => r.rewardName).join(", ")}`
      : `${result.card.stampCount} of ${result.card.requiredStamps} stamps collected.`,
    data: { loyaltyCardId: result.card.id },
  });
}

function programSettings(program: { settings?: unknown }) {
  const settings = program.settings as
    { minMinutesBetweenStamps?: number; maxStampsPerDay?: number } | undefined;
  return {
    minMinutesBetweenStamps: settings?.minMinutesBetweenStamps ?? 5,
    maxStampsPerDay: settings?.maxStampsPerDay ?? 3,
  };
}

/** No card collects more than the program's daily limit, however the stamps arrive (§14). */
async function assertDailyCardCap(cardId: Types.ObjectId, program: { settings?: unknown }) {
  const { maxStampsPerDay } = programSettings(program);
  const today = await Stamp.countDocuments({
    loyaltyCardId: cardId,
    createdAt: { $gte: startOfPakistanDay() },
  });
  if (today >= maxStampsPerDay) {
    throw new ApiError(
      429,
      "DAILY_STAMP_LIMIT",
      `This card has reached today's limit of ${maxStampsPerDay} stamps. Come back tomorrow!`,
    );
  }
}

/** All card-level rules every stamp path applies before writing. */
async function assertCardMayStamp(
  card: { _id: Types.ObjectId; lastStampAt?: Date | null },
  program: { settings?: unknown },
) {
  assertStampCooldown(card.lastStampAt, programSettings(program).minMinutesBetweenStamps);
  await assertDailyCardCap(card._id, program);
}

/**
 * The customer-facing stamp (§13.1). Stamp creation, progress increment and
 * reward unlock all commit together or not at all, so the system can never end
 * up with a stamp that did not count or a reward granted twice.
 */
export async function createStamp(request: StampRequest): Promise<StampResult> {
  // A retry of a request that already succeeded returns the original outcome.
  // Checked first because the tap token that request carried is now consumed.
  if (
    await Stamp.exists({ customerId: request.customerId, idempotencyKey: request.idempotencyKey })
  ) {
    return buildResultForExistingStamp(request.customerId, request.idempotencyKey);
  }

  let tap: Awaited<ReturnType<typeof findUsableTap>> | null = null;
  let deviceIdentifier: string;
  let source: StampSource;

  if ("tapToken" in request) {
    tap = await findUsableTap(request.tapToken);
    deviceIdentifier = tap.deviceIdentifier;
    source = STAMP_SOURCE.NFC;
  } else {
    deviceIdentifier = request.deviceIdentifier;
    source = request.source;
  }

  // Re-resolved even with a tap token: the stamper may have been revoked since the tap.
  const device = await resolveDeviceForStamping(deviceIdentifier);
  if (!tap && device.tagType !== TAG_TYPE.STATIC) {
    throw new ApiError(400, "TAP_REQUIRED", "Tap the stamper with your phone to collect a stamp.");
  }

  const { card, program } = await resolveCardForDevice(
    request.customerId,
    device.businessId,
    device.branchId,
  );
  await assertCardMayStamp(card, program);

  // A first stamp for an account made today; many of these at one stamper is an alert.
  const newCustomer =
    !card.lastStampAt &&
    Boolean(
      await User.exists({
        _id: request.customerId,
        createdAt: { $gte: new Date(Date.now() - DAY_MS) },
      }),
    );

  const usedTap = tap;
  const result = await commitStamp(
    {
      customerId: request.customerId,
      cardId: card._id,
      program,
      businessId: device.businessId,
      branchId: device.branchId,
      deviceId: device.deviceId,
      source,
      idempotencyKey: request.idempotencyKey,
      metadata: {
        ...(request.metadata ?? {}),
        ...(usedTap ? { tapCounter: usedTap.tapCounter } : {}),
        ...(newCustomer ? { newCustomer: true } : {}),
      },
    },
    usedTap ? (session) => consumeTap(usedTap._id, request.customerId, session) : undefined,
  );

  if (!result.alreadyRecorded) {
    void checkDeviceBurst(device.businessId, device.deviceId);
    void checkOutsideHours({
      businessId: device.businessId,
      branchId: device.branchId,
      deviceId: device.deviceId,
    });
    if (newCustomer) void checkNewAccountBurst(device.businessId, device.deviceId);
  }
  // In-app history only: the customer already sees the stamp in this response.
  void notifyStamp(request.customerId, result).catch((err) =>
    logger.warn({ err }, "Stamp notification failed"),
  );
  return result;
}

/** How many stamps one staff member may add per day at this business. */
async function staffDailyCap(businessId: string): Promise<number> {
  const business = await Business.findById(businessId).select("settings");
  const cap = (business?.settings as { staffDailyStampCap?: number } | undefined)
    ?.staffDailyStampCap;
  return cap ?? 100;
}

interface StaffStampParams {
  businessId: string;
  actorUserId: string;
  card: InstanceType<typeof LoyaltyCard>;
  branchId: string;
  idempotencyKey: string;
  source: typeof STAMP_SOURCE.ADMIN | typeof STAMP_SOURCE.STAFF;
  auditAction: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
  /** Runs inside the stamp transaction (e.g. spending the customer's counter code). */
  beforeWrite?: (session: ClientSession) => Promise<void>;
  metadata?: Record<string, unknown>;
}

/**
 * A stamp added by staff rather than by a tap. Same transaction, cooldown,
 * daily card limit and reward rules as a tap, plus a daily limit per staff
 * member; always audited (§13, §37).
 */
async function createStaffStamp(params: StaffStampParams): Promise<StampResult> {
  const { card } = params;
  const customerId = card.customerId.toString();
  if (await Stamp.exists({ customerId, idempotencyKey: params.idempotencyKey })) {
    return buildResultForExistingStamp(customerId, params.idempotencyKey);
  }

  const branch = await Branch.exists({ _id: params.branchId, businessId: params.businessId });
  if (!branch) throw ApiError.badRequest("Branch does not belong to this business");

  const program = await LoyaltyProgram.findOne({
    _id: card.programId,
    businessId: params.businessId,
    status: PROGRAM_STATUS.ACTIVE,
  });
  if (!program) throw ApiError.badRequest("This loyalty program is not active");

  const scoped = program.branches.length > 0;
  if (scoped && !program.branches.some((id) => id.toString() === params.branchId)) {
    throw ApiError.badRequest("This loyalty program does not run at that branch");
  }

  const cap = await staffDailyCap(params.businessId);
  const issuedToday = await Stamp.countDocuments({
    businessId: params.businessId,
    issuedBy: params.actorUserId,
    createdAt: { $gte: startOfPakistanDay() },
  });
  if (issuedToday >= cap) {
    await raiseFlag({
      businessId: params.businessId,
      type: "STAFF_DAILY_CAP",
      message: `A staff member reached the daily limit of ${cap} stamps.`,
      staffUserId: params.actorUserId,
      details: { cap },
    });
    throw new ApiError(
      429,
      "STAFF_DAILY_LIMIT",
      `You have added ${cap} stamps today, the most allowed. Ask a manager if this is a mistake.`,
    );
  }

  await assertCardMayStamp(card, program);

  const result = await commitStamp(
    {
      customerId,
      cardId: card._id,
      program,
      businessId: params.businessId,
      branchId: params.branchId,
      issuedBy: params.actorUserId,
      source: params.source,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata ?? {},
    },
    params.beforeWrite,
  );

  if (!result.alreadyRecorded) {
    void checkOutsideHours({
      businessId: params.businessId,
      branchId: params.branchId,
      staffUserId: params.actorUserId,
    });
    await recordAudit({
      actorUserId: params.actorUserId,
      businessId: params.businessId,
      action: params.auditAction,
      resourceType: "Stamp",
      resourceId: result.stampId,
      metadata: { customerId, loyaltyCardId: card._id.toString(), branchId: params.branchId },
    });
  }

  await notifyStamp(customerId, result);
  return result;
}

/**
 * Manual stamp by a manager or owner, found by search (no proof the customer
 * is present, so not available to ordinary staff).
 */
export async function createManualStamp(params: {
  businessId: string;
  actorUserId: string;
  loyaltyCardId: string;
  branchId: string;
  idempotencyKey: string;
}): Promise<StampResult> {
  const card = await LoyaltyCard.findOne({
    _id: params.loyaltyCardId,
    businessId: params.businessId,
    status: LOYALTY_CARD_STATUS.ACTIVE,
  });
  if (!card) throw ApiError.notFound("Loyalty card not found for this business");

  return createStaffStamp({
    ...params,
    card,
    source: STAMP_SOURCE.ADMIN,
    auditAction: AUDIT_ACTIONS.STAMP_ISSUED_MANUAL,
  });
}

/**
 * Counter stamp: staff read the short code on the customer's card (scanned
 * or typed). The code is spent inside the stamp transaction, so it can never
 * give two stamps, and an old screenshot of it does not work.
 */
export async function createCounterStamp(params: {
  businessId: string;
  actorUserId: string;
  code: string;
  branchId: string;
  idempotencyKey: string;
}): Promise<StampResult> {
  const counterCode = await CounterCode.findOne({
    code: params.code,
    businessId: params.businessId,
  });

  // A retry after the code was spent still returns the original stamp.
  if (counterCode?.consumedAt) {
    const customerId = counterCode.customerId.toString();
    if (await Stamp.exists({ customerId, idempotencyKey: params.idempotencyKey })) {
      return buildResultForExistingStamp(customerId, params.idempotencyKey);
    }
  }
  if (!counterCode || counterCode.consumedAt || counterCode.expiresAt < new Date()) {
    throw invalidCounterCode();
  }

  const card = await LoyaltyCard.findOne({
    _id: counterCode.loyaltyCardId,
    businessId: params.businessId,
    status: LOYALTY_CARD_STATUS.ACTIVE,
  });
  if (!card) throw invalidCounterCode();

  return createStaffStamp({
    businessId: params.businessId,
    actorUserId: params.actorUserId,
    card,
    branchId: params.branchId,
    idempotencyKey: params.idempotencyKey,
    source: STAMP_SOURCE.STAFF,
    auditAction: AUDIT_ACTIONS.STAMP_ISSUED_COUNTER,
    beforeWrite: async (session) => {
      const spent = await CounterCode.findOneAndUpdate(
        { _id: counterCode._id, consumedAt: null },
        { $set: { consumedAt: new Date() } },
        { session },
      );
      if (!spent) throw invalidCounterCode();
    },
  });
}

function invalidCounterCode() {
  return new ApiError(
    400,
    "COUNTER_CODE_INVALID",
    "That code is not valid any more. Ask the customer to open their card again.",
  );
}

export async function listCustomerStamps(customerId: string, limit = 50) {
  return Stamp.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("businessId", "name logo");
}

export async function listBusinessStamps(
  businessId: string,
  options: { branchIds?: string[] } & CursorRequest,
) {
  const filter: Record<string, unknown> = { businessId };
  if (options.branchIds?.length) filter.branchId = { $in: options.branchIds };

  const rows = await Stamp.find(afterCursor(filter, "createdAt", options.cursor))
    .sort(sortFor("createdAt"))
    .limit(options.limit + 1)
    .populate("customerId", "name email");
  return toPage(rows, options.limit, "createdAt");
}
