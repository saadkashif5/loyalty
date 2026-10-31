import { Redis } from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

// State that must hold across API instances: rate limits today; OTPs, tap
// tokens and caches as they are built. Without REDIS_URL (development, tests)
// a single process keeps that state in memory instead.
export const redis = env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 }) : null;

redis?.on("error", (err) => logger.error({ err }, "Redis error"));

export async function disconnectRedis(): Promise<void> {
  await redis?.quit();
}
