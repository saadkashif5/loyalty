import { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "@/config/database";
import { disconnectRedis } from "@/config/redis";
import { env } from "@/config/env";
import { Business, BusinessMember, Invoice, OutboxMessage, Subscription, User } from "@/models";
import { listPlans } from "@/modules/billing/plans.service";
import { snapshot } from "@/modules/billing/subscriptions.service";
import { runSubscriptionJob } from "@/jobs/subscriptions.job";

// How long the hourly billing run takes for many businesses at once: trials
// ending (invoice + reminder), periods lapsing (past due), grace ending
// (suspension). Seeds a throwaway database whose name contains "load".
//   LOAD_SUBSCRIPTIONS=2000 npx tsx src/scripts/benchBilling.ts
const COUNT = Number(process.env.LOAD_SUBSCRIPTIONS ?? 2000);
const DAY = 86_400_000;

async function main(): Promise<void> {
  if (!/load/i.test(new URL(env.MONGODB_URI).pathname)) {
    throw new Error('Refusing to run: the database name must contain "load".');
  }
  await connectDatabase();
  const oldOwners = await User.find({ email: /^bench-owner-/ }).select("_id");
  await Promise.all([
    User.deleteMany({ _id: { $in: oldOwners.map((u) => u._id) } }),
    BusinessMember.deleteMany({ userId: { $in: oldOwners.map((u) => u._id) } }),
    Business.deleteMany({ slug: /^bench-/ }),
    Subscription.deleteMany({}),
    Invoice.deleteMany({}),
    OutboxMessage.deleteMany({}),
  ]);

  const plan = (await listPlans()).find((p) => p.code === "STARTER")!;
  const now = Date.now();
  const businesses = [];
  const users = [];
  const members = [];
  const subscriptions = [];
  for (let i = 0; i < COUNT; i += 1) {
    const businessId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    businesses.push({ _id: businessId, name: `Bench ${i}`, slug: `bench-${i}`, status: "ACTIVE" });
    users.push({ _id: ownerId, name: `Owner ${i}`, email: `bench-owner-${i}@load.local` });
    members.push({ businessId, userId: ownerId, role: "OWNER", status: "ACTIVE" });
    // A third each: trial ending in 5 days, paid period just ended, grace just ended.
    const kind = i % 3;
    subscriptions.push({
      businessId,
      plan: snapshot(plan),
      status: kind === 0 ? "TRIALING" : kind === 1 ? "ACTIVE" : "PAST_DUE",
      trialEndsAt: kind === 0 ? new Date(now + 5 * DAY) : new Date(now - 60 * DAY),
      currentPeriodEnd: kind === 1 ? new Date(now - DAY) : null,
      graceEndsAt: kind === 2 ? new Date(now - DAY) : null,
    });
  }
  await Business.insertMany(businesses);
  await User.insertMany(users);
  await BusinessMember.insertMany(members);
  await Subscription.insertMany(subscriptions);

  let rounds = 0;
  const started = performance.now();
  const totals: Record<string, number> = {};
  // The job works in batches of 500; run until it has nothing left to do.
  for (;;) {
    rounds += 1;
    const result = await runSubscriptionJob();
    const work = Object.values(result).reduce((a, b) => a + b, 0);
    for (const [k, v] of Object.entries(result)) totals[k] = (totals[k] ?? 0) + v;
    if (work === 0 || rounds > 50) break;
  }
  const ms = performance.now() - started;
  const queued = await OutboxMessage.countDocuments();
  console.log(
    `${COUNT} subscriptions: ${Math.round(ms)} ms over ${rounds} runs ` +
      `(${(ms / COUNT).toFixed(1)} ms each); ${queued} emails queued`,
  );
  console.log(totals);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([disconnectDatabase(), disconnectRedis()]));
