import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "@/config/env";
import { RefreshToken } from "@/models";
import type { Types } from "mongoose";

export interface AccessTokenPayload {
  sub: string; // userId
  type: "access";
}

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { sub: userId, type: "access" };
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
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

// Refresh tokens are random opaque strings (not JWTs) so they carry no
// decodable payload; only their hash is persisted (§23.1, §30).
export async function issueRefreshToken(
  userId: Types.ObjectId | string,
  context: { userAgent?: string; ip?: string } = {},
): Promise<string> {
  const raw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL));

  await RefreshToken.create({
    userId,
    tokenHash: hashToken(raw),
    expiresAt,
    userAgent: context.userAgent,
    ip: context.ip,
  });

  return raw;
}

export async function rotateRefreshToken(
  rawToken: string,
  context: { userAgent?: string; ip?: string } = {},
): Promise<{ userId: string; newRawToken: string } | null> {
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    // Reuse of a revoked/expired token is a signal of theft — revoke the whole chain defensively.
    if (existing?.revokedAt) {
      await RefreshToken.updateMany({ userId: existing.userId, revokedAt: null }, { revokedAt: new Date() });
    }
    return null;
  }

  const newRawToken = crypto.randomBytes(48).toString("hex");
  const newHash = hashToken(newRawToken);

  existing.revokedAt = new Date();
  existing.replacedByTokenHash = newHash;
  await existing.save();

  await RefreshToken.create({
    userId: existing.userId,
    tokenHash: newHash,
    expiresAt: new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL)),
    userAgent: context.userAgent,
    ip: context.ip,
  });

  return { userId: existing.userId.toString(), newRawToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await RefreshToken.updateOne({ tokenHash: hashToken(rawToken) }, { revokedAt: new Date() });
}

export async function revokeAllUserSessions(userId: Types.ObjectId | string): Promise<void> {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}
