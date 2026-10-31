import bcrypt from "bcryptjs";
import { User, type UserDocument } from "@/models";
import { ApiError } from "@/utils/ApiError";
import type { RegisterInput, LoginInput, MfaLoginInput } from "@taptapsell/validation";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  signAccessToken,
  signMfaChallenge,
  verifyMfaChallenge,
} from "./token.service";
import { verifySecondFactor } from "./mfa.service";

const SALT_ROUNDS = 12;

export interface AuthContext {
  userAgent?: string;
  ip?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type LoginResult =
  | { mfaRequired: false; user: UserDocument; tokens: AuthTokens }
  | { mfaRequired: true; mfaToken: string };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function issueTokenPair(userId: string, ctx: AuthContext): Promise<AuthTokens> {
  const { raw, sessionId } = await issueRefreshToken(userId, ctx);
  return { accessToken: signAccessToken(userId, sessionId), refreshToken: raw };
}

export async function register(input: RegisterInput, ctx: AuthContext = {}) {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
  });

  const tokens = await issueTokenPair(user.id, ctx);
  return { user, tokens };
}

export async function login(input: LoginInput, ctx: AuthContext = {}): Promise<LoginResult> {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  // Constant-shaped response regardless of which check fails, to avoid user enumeration.
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    throw ApiError.forbidden("This account is not active");
  }

  // The password alone is not enough: no tokens until the second factor passes.
  if (user.mfa?.enabled) {
    return { mfaRequired: true, mfaToken: signMfaChallenge(user.id) };
  }

  const tokens = await issueTokenPair(user.id, ctx);
  return { mfaRequired: false, user, tokens };
}

export async function completeMfaLogin(input: MfaLoginInput, ctx: AuthContext = {}) {
  let userId: string;
  try {
    userId = verifyMfaChallenge(input.mfaToken);
  } catch {
    throw ApiError.unauthorized("Your sign-in expired. Please enter your password again.");
  }

  const user = await User.findById(userId);
  if (!user || user.status !== "ACTIVE") {
    throw ApiError.forbidden("This account is not active");
  }

  await verifySecondFactor(userId, { code: input.code, recoveryCode: input.recoveryCode });

  const tokens = await issueTokenPair(userId, ctx);
  return { user, tokens };
}

export async function refresh(rawRefreshToken: string, ctx: AuthContext = {}) {
  const result = await rotateRefreshToken(rawRefreshToken, ctx);
  if (!result) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const accessToken = signAccessToken(result.userId, result.sessionId);
  return { accessToken, refreshToken: result.newRawToken };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  await revokeRefreshToken(rawRefreshToken);
}
