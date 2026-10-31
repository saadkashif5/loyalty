import type { ClientSession } from "mongoose";
import {
  Business,
  BusinessMember,
  Payment,
  PaymentProof,
  Subscription,
  User,
  type PlanDocument,
} from "@/models";
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
import {
  findOpenInvoice,
  getInvoice,
  issueInvoice,
  listInvoices,
  periodPrice,
  settleInvoice,
} from "./invoices.service";
import { getPaymentDetails } from "./settings.service";

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

export { periodPrice };

/** Applied to every invoice from now on; 100 makes the account complimentary. */
export async function setDiscount(
  actorUserId: string,
  businessId: string,
  discountPercent: number,
) {
  const subscription = await getSubscriptionOrThrow(businessId);
  subscription.discountPercent = discountPercent;
  await subscription.save();

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_DISCOUNT_SET,
    resourceType: "Subscription",
    resourceId: subscription._id,
    metadata: { discountPercent },
  });
  return subscription;
}

/** Bills the next period(s) now (normally the scheduled job does this). */
export async function issueInvoiceFor(actorUserId: string | null, businessId: string, periods = 1) {
  const subscription = await getSubscriptionOrThrow(businessId);
  return issueInvoice(subscription, { periods, actorUserId });
}

function dayText(d: Date) {
  return d.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" });
}

/**
 * Money received (bank transfer, Raast, cash, cheque) settles an invoice: the
 * one named, else the open one, else a new one for the requested periods.
 * Paying after a billing suspension starts the period today, so the business
 * does not pay for days it could not stamp.
 */
export async function recordPayment(
  actorUserId: string | null,
  businessId: string,
  input: RecordPaymentInput,
) {
  const subscription = await getSubscriptionOrThrow(businessId);
  const now = new Date();

  const invoice = input.invoiceId
    ? await getInvoice(input.invoiceId, businessId)
    : ((await findOpenInvoice(subscription._id)) ??
      (await issueInvoice(subscription, { periods: input.periods, actorUserId })));

  if (invoice.status !== "ISSUED") {
    throw ApiError.conflict(`Invoice ${invoice.number} is not open for payment`);
  }
  if (input.amountPkr < invoice.totalPkr) {
    throw new ApiError(
      400,
      "PAYMENT_TOO_LOW",
      `Invoice ${invoice.number} is for PKR ${invoice.totalPkr.toLocaleString("en-PK")}. Part payments are not supported.`,
    );
  }

  const business = await Business.findById(businessId).select("status suspension");
  if (business?.suspension?.kind === "BILLING" && invoice.periodStart < now) {
    invoice.periodStart = now;
    invoice.periodEnd = addPeriods(now, invoice.billingCycle as BillingCycle, invoice.periods);
  }

  if (!(await settleInvoice(invoice, subscription, now))) {
    throw ApiError.conflict(`Invoice ${invoice.number} was settled or voided just now`);
  }

  const payment = await Payment.create({
    businessId,
    subscriptionId: subscription._id,
    invoiceId: invoice._id,
    amountPkr: input.amountPkr,
    method: input.method,
    reference: input.reference,
    note: input.note,
    periods: invoice.periods,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    recordedBy: actorUserId,
  });

  await liftBillingSuspension(businessId);

  await recordAudit({
    actorUserId: actorUserId ?? undefined,
    businessId,
    action: AUDIT_ACTIONS.PAYMENT_RECORDED,
    resourceType: "Payment",
    resourceId: payment._id,
    metadata: { invoice: invoice.number, amountPkr: input.amountPkr, method: input.method },
  });

  await emailOwners(
    businessId,
    `Payment received for invoice ${invoice.number}`,
    `We received PKR ${input.amountPkr.toLocaleString("en-PK")} for invoice ${invoice.number}. ` +
      `You are paid up until ${dayText(invoice.periodEnd)}. Thank you!`,
  );

  const updated = await Subscription.findById(subscription._id);
  return { subscription: updated, invoice, payment };
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
  const [usage, payments, plans, invoices, proofs, paymentDetails] = await Promise.all([
    countUsage(businessId),
    Payment.find({ businessId }).sort({ createdAt: -1 }).limit(24),
    listPlans({ publicOnly: true }),
    listInvoices(businessId),
    PaymentProof.find({ businessId }).sort({ createdAt: -1 }).limit(10),
    getPaymentDetails(),
  ]);
  const openInvoice = invoices.find((i) => i.status === "ISSUED") ?? null;

  return {
    subscription,
    nextPaymentPkr: openInvoice?.totalPkr ?? (subscription ? periodPrice(subscription) : null),
    openInvoice,
    invoices,
    proofs,
    paymentDetails,
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
