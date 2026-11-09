import "./instrument";
import { connectDatabase, disconnectDatabase } from "@/config/database";
import { logger } from "@/config/logger";
import { disconnectRedis, redis } from "@/config/redis";
import { runRewardExpiryJob } from "@/jobs/rewardExpiry.job";
import { runSubscriptionJob } from "@/jobs/subscriptions.job";
import { runStampExpiryJob } from "@/jobs/stampExpiry.job";
import { processOutbox } from "@/services/outbox.service";
import { processExports } from "@/services/exports.service";

// Runs apart from the API: sends queued email, builds exports and runs the scheduled jobs.
// Any number of workers may run; messages are claimed one at a time, and with
// Redis only one worker runs the hourly jobs. Without Redis, run a single worker.
const OUTBOX_INTERVAL_MS = 2_000;
const JOBS_INTERVAL_MS = 60 * 60_000;
const EXPORTS_INTERVAL_MS = 5_000;

let stopping = false;

async function holdsJobLock(): Promise<boolean> {
  if (!redis) return true;
  const ttl = Math.floor((JOBS_INTERVAL_MS - 60_000) / 1000);
  return (await redis.set("worker:jobs", "1", "EX", ttl, "NX")) === "OK";
}

async function runJobs() {
  if (!(await holdsJobLock())) return;
  const subscriptions = await runSubscriptionJob();
  const rewards = await runRewardExpiryJob();
  const stamps = await runStampExpiryJob();
  logger.info({ subscriptions, rewards, stamps }, "Scheduled jobs finished");
}

/** Repeats `task`, waiting between runs so a slow one never overlaps itself. */
async function loop(name: string, intervalMs: number, task: () => Promise<unknown>) {
  while (!stopping) {
    try {
      await task();
    } catch (err) {
      logger.error({ err, task: name }, "Worker task failed");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function main(): Promise<void> {
  await connectDatabase();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      stopping = true;
    });
  }
  logger.info("Worker started");
  await Promise.all([
    loop("outbox", OUTBOX_INTERVAL_MS, () => processOutbox()),
    loop("exports", EXPORTS_INTERVAL_MS, () => processExports()),
    loop("jobs", JOBS_INTERVAL_MS, runJobs),
  ]);
  await disconnectRedis();
  await disconnectDatabase();
}

main().catch((err) => {
  logger.error({ err }, "Worker stopped");
  process.exit(1);
});
