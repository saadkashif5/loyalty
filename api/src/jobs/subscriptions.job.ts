import { Business, Subscription } from "@/models";
import { logger } from "@/config/logger";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { applyBusinessStatus } from "@/modules/businesses/businesses.service";
import { emailOwners, periodPrice } from "@/modules/billing/subscriptions.service";
import {
  CANCEL_AFTER_SUSPENDED_DAYS,
  DAY_MS,
  GRACE_DAYS,
  REMIND_BEFORE_DAYS,
} from "@/modules/billing/billing.config";
import { SUBSCRIPTION_STATUS } from "@taptapsell/constants";

const BATCH = 500;

function day(d: Date) {
  return d.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" });
}

/**
 * Moves subscriptions through their lifecycle and tells owners at each step:
 *
 *   TRIALING / ACTIVE ─(end passes)→ PAST_DUE ─(grace ends)→ SUSPENDED ─(90 days)→ CANCELLED
 *
 * Safe to run often (e.g. hourly): every change is a conditional update on
 * the current status, and each reminder is sent once (lastReminderKey).
 */
export async function runSubscriptionJob(now: Date = new Date()) {
  const result = { pastDue: 0, suspended: 0, cancelled: 0, reminded: 0 };
  const soon = new Date(now.getTime() + REMIND_BEFORE_DAYS * DAY_MS);

  // 1. Reminders before a trial or a paid period ends.
  const ending = await Subscription.find({
    $or: [
      { status: SUBSCRIPTION_STATUS.TRIALING, trialEndsAt: { $gt: now, $lte: soon } },
      { status: SUBSCRIPTION_STATUS.ACTIVE, currentPeriodEnd: { $gt: now, $lte: soon } },
    ],
  }).limit(BATCH);
  for (const sub of ending) {
    const trial = sub.status === SUBSCRIPTION_STATUS.TRIALING;
    const end = (trial ? sub.trialEndsAt : sub.currentPeriodEnd)!;
    const key = `${trial ? "trial-ending" : "renewal"}:${end.toISOString()}`;
    if (!(await claimReminder(sub._id, key))) continue;

    await emailOwners(
      String(sub.businessId),
      trial
        ? `Your TapTapSell trial ends on ${day(end)}`
        : `Your TapTapSell plan renews on ${day(end)}`,
      `${trial ? "Your free trial" : "Your current period"} ends on ${day(end)}. ` +
        `To keep stamping without interruption, pay PKR ${periodPrice(sub).toLocaleString("en-PK")} ` +
        `for the ${sub.plan.name} plan. See Billing in your dashboard for how to pay.`,
    );
    result.reminded += 1;
  }

  // 2. Trial or period over, unpaid: past due, with a grace period.
  const lapsed = await Subscription.find({
    $or: [
      { status: SUBSCRIPTION_STATUS.TRIALING, trialEndsAt: { $ne: null, $lte: now } },
      { status: SUBSCRIPTION_STATUS.ACTIVE, currentPeriodEnd: { $ne: null, $lte: now } },
    ],
  }).limit(BATCH);
  for (const sub of lapsed) {
    const endedAt = (
      sub.status === SUBSCRIPTION_STATUS.TRIALING ? sub.trialEndsAt : sub.currentPeriodEnd
    )!;
    const graceEndsAt = new Date(endedAt.getTime() + GRACE_DAYS * DAY_MS);
    const moved = await Subscription.updateOne(
      { _id: sub._id, status: sub.status },
      { $set: { status: SUBSCRIPTION_STATUS.PAST_DUE, graceEndsAt } },
    );
    if (moved.modifiedCount !== 1) continue;
    result.pastDue += 1;

    await audit(sub.businessId, sub._id, sub.status, SUBSCRIPTION_STATUS.PAST_DUE);
    await emailOwners(
      String(sub.businessId),
      "Your TapTapSell payment is due",
      `Your ${sub.status === SUBSCRIPTION_STATUS.TRIALING ? "trial" : "plan"} has ended. ` +
        `Please pay PKR ${periodPrice(sub).toLocaleString("en-PK")} by ${day(graceEndsAt)}; ` +
        "after that, stamping stops until payment arrives.",
    );
  }

  // 3. Grace over: suspend. A business the team already suspended stays as it is.
  const unpaid = await Subscription.find({
    status: SUBSCRIPTION_STATUS.PAST_DUE,
    graceEndsAt: { $ne: null, $lte: now },
  }).limit(BATCH);
  for (const sub of unpaid) {
    const moved = await Subscription.updateOne(
      { _id: sub._id, status: SUBSCRIPTION_STATUS.PAST_DUE },
      { $set: { status: SUBSCRIPTION_STATUS.SUSPENDED, suspendedAt: now } },
    );
    if (moved.modifiedCount !== 1) continue;
    result.suspended += 1;

    try {
      const business = await Business.findById(sub.businessId).select("status");
      if (business?.status === "ACTIVE") {
        await applyBusinessStatus(String(sub.businessId), "SUSPENDED", {
          kind: "BILLING",
          reason: "Unpaid subscription",
        });
      }
    } catch (err) {
      logger.error({ err, businessId: String(sub.businessId) }, "Billing suspension failed");
    }

    await audit(
      sub.businessId,
      sub._id,
      SUBSCRIPTION_STATUS.PAST_DUE,
      SUBSCRIPTION_STATUS.SUSPENDED,
    );
    await emailOwners(
      String(sub.businessId),
      "Your TapTapSell account is suspended",
      "We have not received payment, so customers can no longer collect stamps. " +
        "Rewards they already earned can still be redeemed for 30 days. " +
        "Pay any time to switch everything back on straight away.",
    );
  }

  // 4. Suspended for a long time: cancel.
  const cutoff = new Date(now.getTime() - CANCEL_AFTER_SUSPENDED_DAYS * DAY_MS);
  const abandoned = await Subscription.find({
    status: SUBSCRIPTION_STATUS.SUSPENDED,
    suspendedAt: { $ne: null, $lte: cutoff },
  }).limit(BATCH);
  for (const sub of abandoned) {
    const moved = await Subscription.updateOne(
      { _id: sub._id, status: SUBSCRIPTION_STATUS.SUSPENDED },
      { $set: { status: SUBSCRIPTION_STATUS.CANCELLED, cancelledAt: now } },
    );
    if (moved.modifiedCount !== 1) continue;
    result.cancelled += 1;
    await audit(
      sub.businessId,
      sub._id,
      SUBSCRIPTION_STATUS.SUSPENDED,
      SUBSCRIPTION_STATUS.CANCELLED,
    );
  }

  return result;
}

/** Marks a reminder as sent; false if this exact reminder already went out. */
async function claimReminder(subscriptionId: unknown, key: string): Promise<boolean> {
  const claimed = await Subscription.updateOne(
    { _id: subscriptionId, lastReminderKey: { $ne: key } },
    { $set: { lastReminderKey: key } },
  );
  return claimed.modifiedCount === 1;
}

async function audit(businessId: unknown, subscriptionId: unknown, from: string, to: string) {
  await recordAudit({
    businessId: businessId as string,
    action: AUDIT_ACTIONS.SUBSCRIPTION_STATUS_CHANGED,
    resourceType: "Subscription",
    resourceId: subscriptionId as string,
    metadata: { from, to },
  });
}
