import rateLimit from "express-rate-limit";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";

// Global baseline (§14, §30). Sensitive routes (stamps, auth) apply stricter
// limits on top of this via their own route-level middleware.
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(ApiError.tooManyRequests()),
});

export function createRateLimiter(options: { windowMs: number; max: number }) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(ApiError.tooManyRequests()),
  });
}
