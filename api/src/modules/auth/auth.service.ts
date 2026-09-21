import bcrypt from "bcryptjs";
import { User, type UserDocument } from "@/models";
import { ApiError } from "@/utils/ApiError";
import type { RegisterInput, LoginInput } from "@taptapsell/validation";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  signAccessToken,
} from "./token.service";

const SALT_ROUNDS = 12;

interface AuthContext {
  userAgent?: string;
  ip?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

async function issueTokenPair(user: UserDocument, ctx: AuthContext): Promise<AuthTokens> {
  const accessToken = signAccessToken(user.id);
  const refreshToken = await issueRefreshToken(user.id, ctx);
  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput, ctx: AuthContext = {}) {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
  });

  const tokens = await issueTokenPair(user, ctx);
  return { user, tokens };
}

export async function login(input: LoginInput, ctx: AuthContext = {}) {
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

  const tokens = await issueTokenPair(user, ctx);
  return { user, tokens };
}

export async function refresh(rawRefreshToken: string, ctx: AuthContext = {}) {
  const result = await rotateRefreshToken(rawRefreshToken, ctx);
  if (!result) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const accessToken = signAccessToken(result.userId);
  return { accessToken, refreshToken: result.newRawToken };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  await revokeRefreshToken(rawRefreshToken);
}
