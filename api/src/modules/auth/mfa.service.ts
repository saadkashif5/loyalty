import crypto from "node:crypto";
import { BusinessMember, User } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { randomCode } from "@/utils/codes";
import { open, seal } from "@/utils/secretBox";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  verifyTotp,
} from "@/utils/totp";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { revokeAllUserSessions, revokeOtherSessions } from "./token.service";
import { BUSINESS_ROLES, MEMBER_STATUS } from "@taptapsell/constants";

const RECOVERY_CODE_COUNT = 10;

function hashRecoveryCode(code: string): string {
  const normalised = code.replace(/[\s-]/g, "").toUpperCase();
  return crypto.createHash("sha256").update(normalised).digest("hex");
}

function invalidCode() {
  return new ApiError(401, "INVALID_MFA_CODE", "That code is not valid. Please try again.");
}

/** Platform users and business owners may not turn two-step verification off (ROADMAP D2). */
export async function isMfaMandatory(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select("platformRole");
  if (user?.platformRole) return true;

  const ownership = await BusinessMember.exists({
    userId,
    role: BUSINESS_ROLES.OWNER,
    status: MEMBER_STATUS.ACTIVE,
  });
  return Boolean(ownership);
}

/** Starts enrolment: a new secret is kept pending until the user proves their app has it. */
export async function startMfaSetup(userId: string) {
  const user = await User.findById(userId).select("email mfa.enabled");
  if (!user) throw ApiError.notFound("User not found");
  if (user.mfa?.enabled) throw ApiError.conflict("Two-step verification is already on");

  const secret = base32Encode(generateTotpSecret());
  await User.updateOne({ _id: userId }, { $set: { "mfa.pendingSecret": seal(secret) } });

  return { secret, otpauthUri: otpauthUri(secret, user.email) };
}

/** Confirms enrolment with a code from the app and returns one-time recovery codes. */
export async function enableMfa(
  userId: string,
  code: string,
  currentSessionId?: string,
): Promise<string[]> {
  const user = await User.findById(userId).select("+mfa.pendingSecret mfa.enabled");
  if (!user?.mfa?.pendingSecret) {
    throw ApiError.badRequest("Start two-step verification setup first");
  }
  if (user.mfa.enabled) throw ApiError.conflict("Two-step verification is already on");

  const secret = open(user.mfa.pendingSecret);
  const step = verifyTotp(base32Decode(secret), code);
  if (step === null) throw invalidCode();

  const recoveryCodes = Array.from(
    { length: RECOVERY_CODE_COUNT },
    () => `${randomCode(4)}-${randomCode(4)}`,
  );

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "mfa.enabled": true,
        "mfa.enabledAt": new Date(),
        "mfa.secret": user.mfa.pendingSecret,
        "mfa.lastUsedStep": step,
        "mfa.recoveryCodeHashes": recoveryCodes.map(hashRecoveryCode),
      },
      $unset: { "mfa.pendingSecret": "" },
    },
  );

  // Sessions opened before the second factor existed never passed it; end them
  // all except the one that just proved the code.
  if (currentSessionId) await revokeOtherSessions(userId, currentSessionId);
  else await revokeAllUserSessions(userId);

  await recordAudit({
    actorUserId: userId,
    action: AUDIT_ACTIONS.MFA_ENABLED,
    resourceType: "User",
    resourceId: userId,
  });

  return recoveryCodes;
}

/**
 * Checks a second factor for a user with MFA on. A TOTP code is accepted at
 * most once (its time step must be newer than the last one used); a recovery
 * code is removed as it is used. Both checks are single atomic updates, so two
 * concurrent requests with the same code cannot both succeed.
 */
export async function verifySecondFactor(
  userId: string,
  input: { code?: string; recoveryCode?: string },
): Promise<void> {
  if (input.recoveryCode) {
    const result = await User.updateOne(
      {
        _id: userId,
        "mfa.enabled": true,
        "mfa.recoveryCodeHashes": hashRecoveryCode(input.recoveryCode),
      },
      { $pull: { "mfa.recoveryCodeHashes": hashRecoveryCode(input.recoveryCode) } },
    );
    if (result.modifiedCount !== 1) throw invalidCode();

    await recordAudit({
      actorUserId: userId,
      action: AUDIT_ACTIONS.MFA_RECOVERY_CODE_USED,
      resourceType: "User",
      resourceId: userId,
    });
    return;
  }

  const user = await User.findById(userId).select("+mfa.secret mfa.enabled");
  if (!user?.mfa?.enabled || !user.mfa.secret || !input.code) throw invalidCode();

  const step = verifyTotp(base32Decode(open(user.mfa.secret)), input.code);
  if (step === null) throw invalidCode();

  const result = await User.updateOne(
    {
      _id: userId,
      $or: [{ "mfa.lastUsedStep": null }, { "mfa.lastUsedStep": { $lt: step } }],
    },
    { $set: { "mfa.lastUsedStep": step } },
  );
  if (result.modifiedCount !== 1) throw invalidCode();
}

export async function disableMfa(userId: string, code: string): Promise<void> {
  if (await isMfaMandatory(userId)) {
    throw ApiError.forbidden("Two-step verification is required for your account");
  }

  await verifySecondFactor(userId, { code });
  await User.updateOne(
    { _id: userId },
    {
      $set: { "mfa.enabled": false },
      $unset: {
        "mfa.secret": "",
        "mfa.pendingSecret": "",
        "mfa.lastUsedStep": "",
        "mfa.recoveryCodeHashes": "",
        "mfa.enabledAt": "",
      },
    },
  );

  await recordAudit({
    actorUserId: userId,
    action: AUDIT_ACTIONS.MFA_DISABLED,
    resourceType: "User",
    resourceId: userId,
  });
}
