import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    // Shared state across API instances. Required in staging and production.
    REDIS_URL: z.string().optional(),
    // Error tracking. Unset in development and tests.
    SENTRY_DSN: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("30d"),

    CORS_ORIGINS: z.string().default(""),
    // Shared with the dashboard and admin servers so they can pass on the
    // user's real IP (see middleware/clientIp.ts). Required in staging and production.
    INTERNAL_API_SECRET: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().min(32, "Must be at least 32 characters").optional(),
    ),
    // Email delivery. "log" prints messages to the console (development only);
    // "smtp" sends through any SMTP provider (Gmail, SES, Brevo, ...).
    EMAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
    SMTP_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
    EMAIL_FROM: z.string().default("TapTapSell <no-reply@taptapsell.local>"),

    // Where private uploads (payment receipts) are kept until cloud storage is chosen.
    STORAGE_DIR: z.string().default("./storage"),

    // Business dashboard origin, used to build invitation links.
    DASHBOARD_URL: z.url().default("http://localhost:3000"),

    // 32 random bytes, base64. Encrypts MFA secrets at rest. Required in
    // staging and production; development and tests derive a key instead.
    MFA_ENCRYPTION_KEY: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .string()
        .refine((v) => Buffer.from(v, "base64").length === 32, "Must be 32 bytes, base64-encoded")
        .optional(),
    ),

    // Local testing only: two-step verification is neither required nor asked
    // for at sign-in. The API refuses to start with this in staging or production.
    SKIP_MFA: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  })
  // Deployed environments must not start with development-style settings.
  .superRefine((e, ctx) => {
    if (!["staging", "production"].includes(e.NODE_ENV)) return;

    if (e.SKIP_MFA) {
      ctx.addIssue({
        code: "custom",
        path: ["SKIP_MFA"],
        message: "Must not be set in staging or production",
      });
    }
    if (!e.REDIS_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["REDIS_URL"],
        message: "Required in staging and production",
      });
    }
    if (!e.CORS_ORIGINS.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGINS"],
        message: "Required in staging and production",
      });
    }
    if (e.EMAIL_TRANSPORT !== "smtp" || !e.SMTP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_TRANSPORT"],
        message: "Staging and production must send real email: EMAIL_TRANSPORT=smtp with SMTP_URL",
      });
    }
    if (!e.INTERNAL_API_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["INTERNAL_API_SECRET"],
        message: "Required in staging and production",
      });
    }
    if (!e.MFA_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["MFA_ENCRYPTION_KEY"],
        message: "Required in staging and production",
      });
    }
    if (e.JWT_ACCESS_SECRET === e.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "Must differ from JWT_ACCESS_SECRET",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
