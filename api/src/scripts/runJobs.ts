import { connectDatabase, disconnectDatabase } from "@/config/database";
import { runSubscriptionJob } from "@/jobs/subscriptions.job";
import { runRewardExpiryJob } from "@/jobs/rewardExpiry.job";

// Every scheduled job, in one run. Schedule it (e.g. hourly cron) until the
// Phase 4 worker service exists:  npm run jobs --workspace=api
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
  .finally(() => disconnectDatabase());
