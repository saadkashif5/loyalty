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

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  })
  // Deployed environments must not start with development-style settings.
  .superRefine((e, ctx) => {
    if (!["staging", "production"].includes(e.NODE_ENV)) return;

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
