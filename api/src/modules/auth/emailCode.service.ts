import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "@/config/env";
import { OtpChallenge, User } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { sendEmail } from "@/services/email.service";
import type { RequestEmailCodeInput, VerifyEmailCodeInput } from "@taptapsell/validation";
import { issueTokenPair, type AuthContext } from "./auth.service";
import { revokeAllUserSessions, signMfaChallenge } from "./token.service";
import { toPublicUser } from "./auth.serializer";
import { BRAND } from "@taptapsell/brand";

const CODE_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;
const DUPLICATE_KEY_ERROR = 11000;

// Keyed with a server secret, so stored hashes cannot be brute-forced offline.
const codeKey = crypto.createHash("sha256").update(`email-code:${env.JWT_ACCESS_SECRET}`).digest();

function hashCode(email: string, code: string): string {
  return crypto.createHmac("sha256", codeKey).update(`${email}:${code}`).digest("hex");
}

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

function codeEmail(code: string) {
  const text = [
    `Your ${BRAND.name} code is ${code}`,
    "",
    "Enter it on the page you came from. It expires in 5 minutes.",
    "If you did not ask for this code, you can ignore this email.",
    "",
    `آپ کا ${BRAND.name} کوڈ ${code} ہے۔ یہ 5 منٹ میں ختم ہو جائے گا۔`,
  ].join("\n");

  return { subject: `${code} is your ${BRAND.name} code`, text };
}

/**
 * Sends a sign-in code. Works the same whether or not an account exists for
 * the email, so the form cannot be used to find out who has an account.
 */
export async function requestEmailCode(input: RequestEmailCodeInput) {
  const email = normalise(input.email);

  const latest = await OtpChallenge.findOne({ email }).sort({ createdAt: -1 }).select("createdAt");
  const waitedMs = latest?.createdAt ? Date.now() - latest.createdAt.getTime() : Infinity;
  if (waitedMs < RESEND_COOLDOWN_MS) {
    const seconds = Math.ceil((RESEND_COOLDOWN_MS - waitedMs) / 1000);
    throw new ApiError(
      429,
      "CODE_COOLDOWN",
      `Please wait ${seconds} seconds before asking for another code.`,
    );
  }

  // Only the newest code works.
  await OtpChallenge.updateMany({ email, consumedAt: null }, { consumedAt: new Date() });

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const challenge = await OtpChallenge.create({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  try {
    await sendEmail({ to: email, ...codeEmail(code) });
  } catch {
    await OtpChallenge.deleteOne({ _id: challenge._id });
    throw new ApiError(
      503,
      "EMAIL_UNAVAILABLE",
      "We could not send the email. Please try again shortly.",
    );
  }

  return { challengeId: challenge._id.toString(), expiresInSeconds: CODE_TTL_MS / 1000 };
}

export type VerifyEmailCodeResult =
  | { status: "NAME_REQUIRED" }
  | { status: "MFA_REQUIRED"; mfaToken: string }
  | {
      status: "SIGNED_IN";
      created: boolean;
      user: ReturnType<typeof toPublicUser>;
      accessToken: string;
      refreshToken: string;
    };

function expired() {
  return new ApiError(400, "CODE_EXPIRED", "This code has expired. Ask for a new one.");
}

/**
 * Checks a code and signs the person in, creating their account on first use.
 * An unknown email without a name gets NAME_REQUIRED back and the code stays
 * valid, so the page can ask for the name and send the same code again.
 */
export async function verifyEmailCode(
  input: VerifyEmailCodeInput,
  ctx: AuthContext,
): Promise<VerifyEmailCodeResult> {
  const now = new Date();

  // Counting the attempt first, atomically, so parallel guesses cannot exceed the limit.
  const challenge = await OtpChallenge.findOneAndUpdate(
    {
      _id: input.challengeId,
      consumedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: MAX_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { new: true },
  );

  if (!challenge) {
    const existing = await OtpChallenge.findById(input.challengeId).select(
      "attempts consumedAt expiresAt",
    );
    if (existing && !existing.consumedAt && existing.expiresAt > now) {
      throw new ApiError(429, "TOO_MANY_ATTEMPTS", "Too many wrong codes. Ask for a new one.");
    }
    throw expired();
  }

  const expected = Buffer.from(challenge.codeHash, "hex");
  const actual = Buffer.from(hashCode(challenge.email, input.code), "hex");
  if (!crypto.timingSafeEqual(expected, actual)) {
    throw new ApiError(
      400,
      "INVALID_CODE",
      "That code is not right. Check the email and try again.",
    );
  }

  let user = await User.findOne({ email: challenge.email });
  if (!user && !input.name) return { status: "NAME_REQUIRED" };
  if (user && user.status !== "ACTIVE") throw ApiError.forbidden("This account is not active");

  const consumed = await OtpChallenge.findOneAndUpdate(
    { _id: challenge._id, consumedAt: null },
    { consumedAt: now },
  );
  if (!consumed) throw expired();

  let created = false;
  if (!user) {
    try {
      user = await User.create({ name: input.name, email: challenge.email, emailVerifiedAt: now });
      created = true;
    } catch (err) {
      // Two sign-ups for the same email at once: the other one won.
      if (!(err instanceof mongoose.mongo.MongoServerError && err.code === DUPLICATE_KEY_ERROR))
        throw err;
      user = await User.findOne({ email: challenge.email });
      if (!user) throw err;
    }
  } else if (!user.emailVerifiedAt) {
    // First proof that this person owns the email. Anyone can register a
    // password account for an address they do not own, so whatever was set up
    // before now is untrusted: drop that password and end every session, or
    // the squatter would share the account with its real owner.
    await User.updateOne(
      { _id: user._id },
      { $set: { emailVerifiedAt: now }, $unset: { passwordHash: "" } },
    );
    await revokeAllUserSessions(user._id);
    user.emailVerifiedAt = now;
  }

  // The email code replaces the password, not the second factor.
  if (user.mfa?.enabled && !env.SKIP_MFA)
    return { status: "MFA_REQUIRED", mfaToken: signMfaChallenge(user.id) };

  const tokens = await issueTokenPair(user.id, ctx);
  return { status: "SIGNED_IN", created, user: toPublicUser(user), ...tokens };
}
