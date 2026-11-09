import crypto from "node:crypto";
import type { ClientSession } from "mongoose";
import { NfcDevice, TapToken } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { cached, invalidate } from "@/services/cache.service";
import { raiseFlag } from "@/services/fraud.service";
import { bumpStat } from "@/services/stats.service";
import { resolveDeviceForStamping } from "@/modules/devices/devices.service";
import { getPublicBusiness } from "@/modules/businesses/discovery.service";
import type { RecordTapInput } from "@taptapsell/validation";
import { TAP_VERIFIERS, type VerifiedTap } from "./verifiers";
import { BRAND } from "@taptapsell/brand";

// Long enough to sign up or log in after a first tap; short enough that a
// token lifted off a phone is useless soon after the customer leaves.
const TAP_TOKEN_TTL_MS = 5 * 60_000;

// What the landing page shows. A name change appearing a minute late does no harm.
const PUBLIC_CACHE_SECONDS = 60;

function hashTapToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function invalidTap() {
  return new ApiError(
    400,
    "INVALID_TAP",
    "This tap could not be read. Please tap the stamper again.",
  );
}

async function flagSuspiciousTap(
  device: { deviceId: string; businessId: string },
  reason: "TAG_UID_MISMATCH" | "TAP_REPLAYED",
  tap: VerifiedTap,
) {
  await recordAudit({
    businessId: device.businessId,
    action: AUDIT_ACTIONS.SUSPICIOUS_STAMP_ATTEMPT,
    resourceType: "NfcDevice",
    resourceId: device.deviceId,
    metadata: { reason, tagUid: tap.tagUid, counter: tap.counter },
  });
  // One open alert per stamper and kind; repeats count up on it.
  await raiseFlag({
    businessId: device.businessId,
    type: reason === "TAP_REPLAYED" ? "TAP_REPLAYED" : "TAG_MISMATCH",
    severity: reason === "TAP_REPLAYED" ? "LOW" : "HIGH",
    message:
      reason === "TAP_REPLAYED"
        ? "A stamper link was used again (refreshed, copied or shared)."
        : "A tag claiming to be this stamper reported a different chip.",
    deviceId: device.deviceId,
    details: { tagUid: tap.tagUid, counter: tap.counter },
  });
}

/**
 * Verifies a stamper tap and issues a single-use tap token for it (§10.3, §14).
 * Unauthenticated, because the first tap happens before the customer has an
 * account; the token only proves presence and grants nothing on its own.
 * Also returns the public business and program details for the landing page.
 */
export async function recordTap(input: RecordTapInput) {
  const device = await resolveDeviceForStamping(input.deviceIdentifier);

  const verifier = TAP_VERIFIERS[device.tagType];
  if (!verifier) {
    throw ApiError.badRequest(`This stamper must be used from the ${BRAND.name} app.`);
  }

  const tap = verifier.verify(input.params, { tagUid: device.tagUid });
  if (!tap) {
    bumpStat(device.businessId, "tapsRejected");
    throw invalidTap();
  }

  if (device.tagUid && device.tagUid !== tap.tagUid) {
    bumpStat(device.businessId, "tapsRejected");
    await flagSuspiciousTap(device, "TAG_UID_MISMATCH", tap);
    throw invalidTap();
  }

  // Binds the UID on first use and requires a strictly higher counter in one
  // atomic update, so two requests carrying the same URL cannot both pass.
  const accepted = await NfcDevice.findOneAndUpdate(
    {
      _id: device.deviceId,
      tagUid: { $in: [null, tap.tagUid] },
      $or: [{ lastTapCounter: null }, { lastTapCounter: { $lt: tap.counter } }],
    },
    { $set: { tagUid: tap.tagUid, lastTapCounter: tap.counter, lastTapAt: new Date() } },
  );

  if (!accepted) {
    bumpStat(device.businessId, "tapsRejected");
    await flagSuspiciousTap(device, "TAP_REPLAYED", tap);
    throw new ApiError(
      409,
      "TAP_REPLAYED",
      "This tap has already been used. Please tap the stamper again.",
    );
  }

  bumpStat(device.businessId, "tapsVerified");
  // The chip is bound now, so the next tap must see its UID.
  if (!device.tagUid) await invalidate([`device:${input.deviceIdentifier}`]);

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TAP_TOKEN_TTL_MS);

  await TapToken.create({
    tokenHash: hashTapToken(rawToken),
    deviceId: device.deviceId,
    deviceIdentifier: input.deviceIdentifier,
    businessId: device.businessId,
    branchId: device.branchId,
    tapCounter: tap.counter,
    expiresAt,
  });

  const { business, programs } = await cached(
    `public-business:${device.businessId}`,
    PUBLIC_CACHE_SECONDS,
    () => getPublicBusiness(device.businessId),
  );
  return { tapToken: rawToken, expiresAt, business, programs };
}

export async function findUsableTap(rawToken: string) {
  const tap = await TapToken.findOne({
    tokenHash: hashTapToken(rawToken),
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!tap) {
    throw new ApiError(
      400,
      "TAP_EXPIRED",
      "This tap has expired or was already used. Please tap the stamper again.",
    );
  }
  return tap;
}

/** Marks the tap used, inside the stamp transaction so a failed stamp keeps it usable. */
export async function consumeTap(tapId: unknown, customerId: string, session: ClientSession) {
  const consumed = await TapToken.findOneAndUpdate(
    { _id: tapId, consumedAt: null },
    { $set: { consumedAt: new Date(), consumedBy: customerId } },
    { session },
  );

  if (!consumed) {
    throw new ApiError(
      409,
      "TAP_ALREADY_USED",
      "This tap was already used. Please tap the stamper again.",
    );
  }
}
