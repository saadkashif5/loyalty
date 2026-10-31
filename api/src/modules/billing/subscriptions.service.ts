import type { ClientSession } from "mongoose";
import { Business, BusinessMember, Payment, Subscription, User, type PlanDocument } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { logger } from "@/config/logger";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { sendEmail } from "@/services/email.service";
import { applyBusinessStatus } from "@/modules/businesses/businesses.service";
import {
  BUSINESS_ROLES,
  MEMBER_STATUS,
  SUBSCRIPTION_STATUS,
  type BillingCycle,
} from "@taptapsell/constants";
import type {
  ChangeSubscriptionPlanInput,
  ExtendTrialInput,
  RecordPaymentInput,
} from "@taptapsell/validation";
import { findActivePlan, listPlans } from "./plans.service";
import { countUsage } from "./entitlements.service";
import { DAY_MS, GRACE_DAYS, addPeriods, monthlyValue } from "./billing.config";

function snapshot(plan: PlanDocument) {
  return {
    planId: plan._id,
    code: plan.code,
    name: plan.name,
    version: plan.version,
    priceMonthlyPkr: plan.priceMonthlyPkr,
    priceAnnualPkr: plan.priceAnnualPkr,
    limits: plan.limits,
  };
}

/** Created with the business, before the owner accepts; the trial clock starts on acceptance. */
export async function createTrialSubscription(
  businessId: unknown,
  planCode: string,
  trialDays: number,
  session: ClientSession,
) {
  const plan = await findActivePlan(planCode);
  await Subscription.create(
    [{ businessId, plan: snapshot(plan), status: SUBSCRIPTION_STATUS.TRIALING, trialDays }],
    { session },
  );
}

/** Called when the owner accepts their invitation. No trial means payment is due now. */
export async function startTrial(businessId: unknown, session: ClientSession) {
  const subscription = await Subscription.findOne({
    businessId,
    status: SUBSCRIPTION_STATUS.TRIALING,
    trialEndsAt: null,
  }).session(session);
  if (!subscription) return;

  const now = Date.now();
  if (subscription.trialDays > 0) {
    subscription.trialEndsAt = new Date(now + subscription.trialDays * DAY_MS);
  } else {
    subscription.status = SUBSCRIPTION_STATUS.PAST_DUE;
    subscription.graceEndsAt = new Date(now + GRACE_DAYS * DAY_MS);
  }
  await subscription.save({ session });
}

async function getSubscriptionOrThrow(businessId: string) {
  const subscription = await Subscription.findOne({ businessId });
  if (!subscription) throw ApiError.notFound("This business has no subscription");
  return subscription;
}

/** Lifts a suspension caused by non-payment. A suspension by the team stays in place. */
async function liftBillingSuspension(businessId: string) {
  const business = await Business.findById(businessId).select("status suspension");
  if (business?.status === "SUSPENDED" && business.suspension?.kind === "BILLING") {
    await applyBusinessStatus(businessId, "ACTIVE");
  }
}

/** Takes effect at once. (Proration arrives with invoices.) */
export async function changePlan(
  actorUserId: string,
  businessId: string,
  input: ChangeSubscriptionPlanInput,
) {
  const subscription = await getSubscriptionOrThrow(businessId);
  const plan = await findActivePlan(input.planCode);
  const from = subscription.plan.code;

  subscription.plan = snapshot(plan) as never;
  if (input.billingCycle) subscription.billingCycle = input.billingCycle;
  await subscription.save();

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_PLAN_CHANGED,
    resourceType: "Subscription",
    resourceId: subscription._id,
    metadata: { from, to: plan.code, billingCycle: subscription.billingCycle },
  });
  return subscription;
}

/** More trial days. Also revives a trial that ran out before any payment. */
export async function extendTrial(
  actorUserId: string,
  businessId: string,
  input: ExtendTrialInput,
) {
  const subscription = await getSubscriptionOrThrow(businessId);
  const neverPaid = !subscription.currentPeriodEnd;
  const extendable =
    subscription.status === SUBSCRIPTION_STATUS.TRIALING ||
    (neverPaid &&
      (subscription.status === SUBSCRIPTION_STATUS.PAST_DUE ||
        subscription.status === SUBSCRIPTION_STATUS.SUSPENDED));
  if (!extendable)
    throw ApiError.badRequest("Only a business that has not paid yet can get more trial days");

  const base = Math.max(Date.now(), subscription.trialEndsAt?.getTime() ?? 0);
  subscription.status = SUBSCRIPTION_STATUS.TRIALING;
  subscription.trialEndsAt = new Date(base + input.days * DAY_MS);
  subscription.graceEndsAt = null;
  subscription.suspendedAt = null;
  subscription.lastReminderKey = null;
  await subscription.save();
  await liftBillingSuspension(businessId);

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_TRIAL_EXTENDED,
    resourceType: "Subscription",
    resourceId: subscription._id,
    metadata: { days: input.days, trialEndsAt: subscription.trialEndsAt },
  });
  return subscription;
}

/** What one period costs on the current plan and cycle. */
export function periodPrice(subscription: {
  plan: { priceMonthlyPkr: number; priceAnnualPkr: number };
  billingCycle: string;
}) {
  return subscription.billingCycle === "ANNUAL"
    ? subscription.plan.priceAnnualPkr
    : subscription.plan.priceMonthlyPkr;
}

/**
 * Money received (bank transfer, Raast, cash, cheque). Paid time starts where
 * the business stands now: after any remaining trial or paid period, or today
 * if it is overdue — paying early never loses days.
 */
export async function recordPayment(
  actorUserId: string | null,
  businessId: string,
  input: RecordPaymentInput,
) {
  const subscription = await getSubscriptionOrThrow(businessId);
  const now = new Date();

  const paidUntil = subscription.currentPeriodEnd ?? null;
  const trialUntil =
    subscription.status === SUBSCRIPTION_STATUS.TRIALING ? subscription.trialEndsAt : null;
  const startFrom = [paidUntil, trialUntil, now]
    .filter((d): d is Date => Boolean(d))
    .reduce((latest, d) => (d > latest ? d : latest));

  const periodEnd = addPeriods(startFrom, subscription.billingCycle as BillingCycle, input.periods);
  const continuing = paidUntil !== null && paidUntil > now;

  subscription.status = SUBSCRIPTION_STATUS.ACTIVE;
  subscription.currentPeriodStart = continuing ? subscription.currentPeriodStart : startFrom;
  subscription.currentPeriodEnd = periodEnd;
  subscription.graceEndsAt = null;
  subscription.suspendedAt = null;
  subscription.cancelledAt = null;
  subscription.lastReminderKey = null;
  await subscription.save();

  const payment = await Payment.create({
    businessId,
    subscriptionId: subscription._id,
    amountPkr: input.amountPkr,
    method: input.method,
    reference: input.reference,
    note: input.note,
    periods: input.periods,
    periodStart: startFrom,
    periodEnd,
    recordedBy: actorUserId,
  });

  await liftBillingSuspension(businessId);

  await recordAudit({
    actorUserId: actorUserId ?? undefined,
    businessId,
    action: AUDIT_ACTIONS.PAYMENT_RECORDED,
    resourceType: "Payment",
    resourceId: payment._id,
    metadata: { amountPkr: input.amountPkr, method: input.method, periods: input.periods },
  });

  const until = periodEnd.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" });
  await emailOwners(
    businessId,
    "Payment received — thank you",
    `We received PKR ${input.amountPkr.toLocaleString("en-PK")} for your TapTapSell subscription. You are paid up until ${until}.`,
  );

  return { subscription, payment };
}

/** Sends a message to every active owner of the business. Best effort. */
export async function emailOwners(businessId: string, subject: string, text: string) {
  try {
    const owners = await BusinessMember.find({
      businessId,
      role: BUSINESS_ROLES.OWNER,
      status: MEMBER_STATUS.ACTIVE,
    }).select("userId");
    const users = await User.find({ _id: { $in: owners.map((o) => o.userId) } }).select("email");
    for (const user of users) await sendEmail({ to: user.email, subject, text });
  } catch (err) {
    logger.warn({ err, businessId }, "Billing email failed");
  }
}

/** Everything the owner's Billing page shows. */
export async function getBillingSummary(businessId: string) {
  const subscription = await Subscription.findOne({ businessId });
  const [usage, payments, plans] = await Promise.all([
    countUsage(businessId),
    Payment.find({ businessId }).sort({ createdAt: -1 }).limit(24),
    listPlans({ publicOnly: true }),
  ]);

  return {
    subscription,
    nextPaymentPkr: subscription ? periodPrice(subscription) : null,
    usage,
    payments,
    plans,
  };
}

/** The platform team's view of revenue and collections. */
export async function getFinanceOverview() {
  const [byStatus, active, overdue, recentPayments, collectedThisMonth] = await Promise.all([
    Subscription.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Subscription.find({ status: SUBSCRIPTION_STATUS.ACTIVE }).select("plan billingCycle"),
    Subscription.find({
      status: { $in: [SUBSCRIPTION_STATUS.PAST_DUE, SUBSCRIPTION_STATUS.SUSPENDED] },
    })
      .sort({ graceEndsAt: 1 })
      .limit(200)
      .populate("businessId", "name status"),
    Payment.find().sort({ createdAt: -1 }).limit(20).populate("businessId", "name"),
    Payment.aggregate<{ total: number }>([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$amountPkr" } } },
    ]),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
  const mrrPkr = active.reduce((sum, s) => sum + monthlyValue(s.plan, s.billingCycle), 0);

  return {
    counts: {
      TRIALING: counts.TRIALING ?? 0,
      ACTIVE: counts.ACTIVE ?? 0,
      PAST_DUE: counts.PAST_DUE ?? 0,
      SUSPENDED: counts.SUSPENDED ?? 0,
      CANCELLED: counts.CANCELLED ?? 0,
    },
    mrrPkr,
    arrPkr: mrrPkr * 12,
    collectedThisMonthPkr: collectedThisMonth[0]?.total ?? 0,
    overdue: overdue.map((s) => ({
      subscriptionId: s._id,
      business: s.businessId,
      status: s.status,
      plan: s.plan.name,
      amountDuePkr: periodPrice(s),
      dueSince: s.graceEndsAt ? new Date(s.graceEndsAt.getTime() - GRACE_DAYS * DAY_MS) : null,
      graceEndsAt: s.graceEndsAt,
      suspendedAt: s.suspendedAt,
    })),
    recentPayments,
  };
}
