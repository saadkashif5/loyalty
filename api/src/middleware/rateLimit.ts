import rateLimit, { type Store } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { env, isTest } from "@/config/env";
import { redis } from "@/config/redis";
import { ApiError } from "@/utils/ApiError";

// Counters live in Redis so every API instance enforces the same limit.
// Each limiter gets its own key prefix so their counts never mix.
function storeFor(name: string): Store | undefined {
  if (!redis) return undefined;
  const client = redis;
  return new RedisStore({
    prefix: `rl:${name}:`,
    sendCommand: (command: string, ...args: string[]) =>
      client.call(command, ...args) as Promise<RedisReply>,
  });
}

// Global baseline (§14, §30). Sensitive routes (stamps, auth) apply stricter
// limits on top of this via their own route-level middleware.
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: storeFor("global"),
  // If Redis is unreachable the baseline lets traffic through rather than
  // taking the whole API down; the stricter route limits below fail closed.
  passOnStoreError: true,
  handler: (_req, _res, next) => next(ApiError.tooManyRequests()),
});

export function createRateLimiter(options: { name: string; windowMs: number; max: number }) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    // Integration tests run every request from one IP within a minute.
    skip: () => isTest,
    standardHeaders: true,
    legacyHeaders: false,
    store: storeFor(options.name),
    handler: (_req, _res, next) => next(ApiError.tooManyRequests()),
  });
}
