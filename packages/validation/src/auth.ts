import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().min(7).max(20).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email().max(254),
  /** Which app the link opens: the business dashboard or the platform console. */
  app: z.enum(["dashboard", "console"]).default("dashboard"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(8).max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// ---- Email code sign-in (customers) ------------------------------------------
// One flow for signing up and signing in: request a code, then verify it. A
// name is needed only when no account exists for the email yet.

export const requestEmailCodeSchema = z.object({
  email: z.email().max(254),
});
export type RequestEmailCodeInput = z.infer<typeof requestEmailCodeSchema>;

export const verifyEmailCodeSchema = z.object({
  challengeId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid sign-in request"),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email"),
  name: z.string().trim().min(1).max(120).optional(),
});
export type VerifyEmailCodeInput = z.infer<typeof verifyEmailCodeSchema>;
