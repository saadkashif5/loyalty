import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "@/config/env";
import { RefreshToken } from "@/models";
import type { Types } from "mongoose";

export interface AccessTokenPayload {
  sub: string; // userId
  type: "access";
  /** Session (refresh token record) this access token was issued for. */
  sid: string;
}

interface MfaChallengePayload {
  sub: string;
  type: "mfa_challenge";
}

const MFA_CHALLENGE_TTL = "5m";

export function signAccessToken(userId: string, sessionId: string): string {
  const payload: AccessTokenPayload = { sub: userId, type: "access", sid: sessionId };
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as Partial<AccessTokenPayload>;
  // Other token types share the signing key; only an access token may authenticate a request.
  if (payload.type !== "access" || !payload.sub || !payload.sid) {
    throw new Error("Not an access token");
  }
  return payload as AccessTokenPayload;
}

/** Proof that the password step passed; exchanged for tokens once the second factor checks out. */
export function signMfaChallenge(userId: string): string {
  const payload: MfaChallengePayload = { sub: userId, type: "mfa_challenge" };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: MFA_CHALLENGE_TTL });
}

export function verifyMfaChallenge(token: string): string {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as Partial<MfaChallengePayload>;
  if (payload.type !== "mfa_challenge" || !payload.sub) throw new Error("Not an MFA challenge");
  return payload.sub;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function ttlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 86_400_000;
  return value * unitMs;
}

interface IssuedRefreshToken {
  raw: string;
  sessionId: string;
}

// Refresh tokens are random opaque strings (not JWTs) so they carry no
// decodable payload; only their hash is persisted (§23.1, §30).
export async function issueRefreshToken(
  userId: Types.ObjectId | string,
  context: { userAgent?: string; ip?: string } = {},
): Promise<IssuedRefreshToken> {
  const raw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL));

  const record = await RefreshToken.create({
    userId,
    tokenHash: hashToken(raw),
    expiresAt,
    userAgent: context.userAgent,
    ip: context.ip,
  });

  return { raw, sessionId: record._id.toString() };
}

export async function rotateRefreshToken(
  rawToken: string,
  context: { userAgent?: string; ip?: string } = {},
): Promise<{ userId: string; newRawToken: string; sessionId: string } | null> {
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    // A token that was already rotated being used again means two parties hold
    // it — a sign of theft — so every session is revoked defensively. A token
    // revoked by sign-out is simply refused: the device that was signed out
    // must not take the user's other sessions down with it.
    if (existing?.revokedAt && existing.replacedByTokenHash) {
      await RefreshToken.updateMany(
        { userId: existing.userId, revokedAt: null },
        { revokedAt: new Date() },
      );
    }
    return null;
  }

  const newRawToken = crypto.randomBytes(48).toString("hex");
  const newHash = hashToken(newRawToken);

  existing.revokedAt = new Date();
  existing.replacedByTokenHash = newHash;
  await existing.save();

  const record = await RefreshToken.create({
    userId: existing.userId,
    tokenHash: newHash,
    expiresAt: new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL)),
    userAgent: context.userAgent,
    ip: context.ip,
  });

  return {
    userId: existing.userId.toString(),
    newRawToken,
    sessionId: record._id.toString(),
  };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await RefreshToken.updateOne({ tokenHash: hashToken(rawToken) }, { revokedAt: new Date() });
}

export async function revokeAllUserSessions(userId: Types.ObjectId | string): Promise<void> {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

export async function listActiveSessions(userId: string) {
  return RefreshToken.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select("userAgent ip createdAt")
    .sort({ createdAt: -1 });
}

/** Revokes one of the user's sessions; returns false when it is not theirs or already gone. */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const result = await RefreshToken.updateOne(
    { _id: sessionId, userId, revokedAt: null },
    { revokedAt: new Date() },
  );
  return result.modifiedCount === 1;
}

export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const result = await RefreshToken.updateMany(
    { userId, revokedAt: null, _id: { $ne: keepSessionId } },
    { revokedAt: new Date() },
  );
  return result.modifiedCount;
}
