import crypto from "node:crypto";
import { env } from "@/config/env";
import { PasswordReset, User } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { sendEmail } from "@/services/email.service";
import type { ForgotPasswordInput, ResetPasswordInput } from "@taptapsell/validation";
import { hashPassword } from "./auth.service";
import { revokeAllUserSessions } from "./token.service";
import { BRAND } from "@taptapsell/brand";

const RESET_TTL_MS = 30 * 60_000;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Fixed per app, never taken from the request, so the link cannot point elsewhere.
function resetLink(app: ForgotPasswordInput["app"], raw: string): string {
  const base = app === "console" ? env.ADMIN_URL : env.DASHBOARD_URL;
  return `${base.replace(/\/$/, "")}/reset-password?token=${raw}`;
}

/**
 * Emails a link to set a new password. Answers the same whether or not the
 * account exists, so the form cannot be used to find out who has one. The
 * console only sends links to members of the platform team.
 */
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const user = await User.findOne({ email: input.email.trim().toLowerCase() }).select(
    "email name status platformRole",
  );
  if (!user || user.status !== "ACTIVE") return;
  if (input.app === "console" && !user.platformRole) return;

  // Only the newest link works.
  await PasswordReset.updateMany({ userId: user._id, usedAt: null }, { usedAt: new Date() });
  const raw = crypto.randomBytes(32).toString("base64url");
  await PasswordReset.create({
    userId: user._id,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });

  // Sent straight away rather than queued: the person is waiting for it.
  await sendEmail({
    to: user.email,
    subject: `Reset your ${BRAND.name} password`,
    text: [
      `Hi ${user.name},`,
      "",
      "Use this link to choose a new password. It works once, for 30 minutes:",
      resetLink(input.app, raw),
      "",
      "If you did not ask for this, ignore this email. Your password stays the same.",
    ].join("\n"),
  });

  await recordAudit({
    actorUserId: user._id.toString(),
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
    resourceType: "User",
    resourceId: user._id,
  });
}

/**
 * Sets the new password and signs the account out everywhere, in case the
 * reset is because someone else had the old one. Two-step verification still
 * applies at the next sign-in.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const reset = await PasswordReset.findOneAndUpdate(
    { tokenHash: hashToken(input.token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!reset) {
    throw new ApiError(
      400,
      "RESET_LINK_INVALID",
      "This link has expired or was already used. Ask for a new one.",
    );
  }

  const user = await User.findOneAndUpdate(
    { _id: reset.userId, status: "ACTIVE" },
    // The reset link went to the inbox, so it proves the email too.
    {
      $set: { passwordHash: await hashPassword(input.password) },
      $min: { emailVerifiedAt: new Date() },
    },
    { new: true },
  );
  if (!user) throw ApiError.forbidden("This account is not active");

  await revokeAllUserSessions(user._id);
  await recordAudit({
    actorUserId: user._id.toString(),
    action: AUDIT_ACTIONS.PASSWORD_RESET,
    resourceType: "User",
    resourceId: user._id,
  });
  await sendEmail({
    to: user.email,
    subject: `Your ${BRAND.name} password was changed`,
    text: [
      `Hi ${user.name},`,
      "",
      "Your password was just changed, and you were signed out on every device.",
      `If this was not you, contact the ${BRAND.name} team straight away.`,
    ].join("\n"),
  }).catch(() => undefined);
}
