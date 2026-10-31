import { connectDatabase, disconnectDatabase } from "@/config/database";
import { runRewardExpiryJob } from "@/jobs/rewardExpiry.job";

// Run on a schedule (e.g. hourly cron) until the Phase 4 worker service exists:
//   npm run job:reward-expiry --workspace=api
async function main(): Promise<void> {
  await connectDatabase();
  const result = await runRewardExpiryJob();
  console.log(`Rewards expired: ${result.expired}. Reminders sent: ${result.reminded}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
