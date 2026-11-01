import { connectDatabase, disconnectDatabase } from "@/config/database";
import { disconnectRedis } from "@/config/redis";
import { runSubscriptionJob } from "@/jobs/subscriptions.job";
import { runRewardExpiryJob } from "@/jobs/rewardExpiry.job";

// Every scheduled job, in one run, for use by hand. In production the worker
// (npm run worker) runs these hourly and sends the email they queue.
async function main(): Promise<void> {
  await connectDatabase();
  const subscriptions = await runSubscriptionJob();
  const rewards = await runRewardExpiryJob();
  console.log("Subscriptions:", subscriptions);
  console.log("Rewards:", rewards);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([disconnectDatabase(), disconnectRedis()]));
