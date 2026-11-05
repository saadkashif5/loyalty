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
import { queueEmail } from "@/services/outbox.service";
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
  reissueOpenInvoice,
  renewalPrice,
  settleInvoice,
} from "./invoices.service";
import { quotePlanChange } from "./planQuote";
import { day, invoiceEmail } from "./emails";
import { getPaymentDetails } from "./settings.service";

export function snapshot(plan: PlanDocument) {
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

export async function getSubscriptionOrThrow(businessId: string) {
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

/**
 * The team's plan change: takes effect at once, with no proration. Add a
 * charge by hand if the difference should be billed.
 */
export async function changePlan(
  actorUserId: string,
  businessId: string,
  input: ChangeSubscriptionPlanInput,
) {
  const subscription = await getSubscriptionOrThrow(businessId);
  const plan = await findActivePlan(input.planCode);
  const from = subscription.plan.code;
  if (await PaymentProof.exists({ businessId, status: "PENDING" })) {
    throw ApiError.conflict("Review the waiting receipt first: it was paid against the old price");
  }

  subscription.plan = snapshot(plan) as never;
  if (input.billingCycle) subscription.billingCycle = input.billingCycle;
  subscription.scheduledChange = null;
  await subscription.save();
  await reissueOpenInvoice(subscription, actorUserId, "Replaced after a plan change");

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
    for (const user of users) await queueEmail({ to: user.email, subject, text });
  } catch (err) {
    logger.warn({ err, businessId }, "Billing email failed");
  }
}

const CHURN_WINDOW_DAYS = 30;
const TRIAL_WINDOW_DAYS = 90;

function trialsInWindow(now: number) {
  return { trialEndsAt: { $gte: new Date(now - TRIAL_WINDOW_DAYS * DAY_MS), $lte: new Date(now) } };
}

function percent(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 1000) / 10;
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
    nextPaymentPkr: openInvoice?.totalPkr ?? (subscription ? renewalPrice(subscription) : null),
    planChanges: subscription
      ? Object.fromEntries(
          plans.flatMap((plan) =>
            (["MONTHLY", "ANNUAL"] as const).map((cycle) => [
              `${plan.code}:${cycle}`,
              quotePlanChange(subscription, plan, cycle, usage),
            ]),
          ),
        )
      : {},
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
  const now = Date.now();
  const [
    byStatus,
    active,
    overdue,
    recentPayments,
    collectedThisMonth,
    cancelledRecently,
    trialsEnded,
    trialsConverted,
  ] = await Promise.all([
    Subscription.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Subscription.find({ status: SUBSCRIPTION_STATUS.ACTIVE }).select(
      "plan billingCycle businessId",
    ),
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
    Subscription.countDocuments({
      cancelledAt: { $gte: new Date(now - CHURN_WINDOW_DAYS * DAY_MS) },
    }),
    Subscription.countDocuments(trialsInWindow(now)),
    Subscription.countDocuments({ ...trialsInWindow(now), currentPeriodEnd: { $ne: null } }),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
  const mrrPkr = active.reduce((sum, s) => sum + monthlyValue(s.plan, s.billingCycle), 0);
  const mrrByPlan = new Map<string, { plan: string; businesses: number; mrrPkr: number }>();
  for (const s of active) {
    const row = mrrByPlan.get(s.plan.code) ?? { plan: s.plan.name, businesses: 0, mrrPkr: 0 };
    row.businesses += 1;
    row.mrrPkr += monthlyValue(s.plan, s.billingCycle);
    mrrByPlan.set(s.plan.code, row);
  }
  // Revenue by the city on each business's profile; "Not set" until someone fills it in.
  const cityOf = new Map(
    (
      await Business.find({ _id: { $in: active.map((s) => s.businessId) } }).select("contact.city")
    ).map((b) => [b.id as string, b.contact?.city?.trim() || null]),
  );
  const cities = new Map<string, { city: string; businesses: number; mrrPkr: number }>();
  for (const s of active) {
    const city = cityOf.get(String(s.businessId)) ?? null;
    const key = city?.toLowerCase() ?? "";
    const row = cities.get(key) ?? { city: city ?? "Not set", businesses: 0, mrrPkr: 0 };
    row.businesses += 1;
    row.mrrPkr += monthlyValue(s.plan, s.billingCycle);
    cities.set(key, row);
  }
  const mrrByCity = [...cities.values()].sort((a, b) => b.mrrPkr - a.mrrPkr);

  const paying =
    (counts.ACTIVE ?? 0) + (counts.PAST_DUE ?? 0) + (counts.SUSPENDED ?? 0) + cancelledRecently;

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
    mrrByPlan: [...mrrByPlan.values()].sort((a, b) => b.mrrPkr - a.mrrPkr),
    churnPercent: percent(cancelledRecently, paying),
    trialConversionPercent: percent(trialsConverted, trialsEnded),
    trialsEnded,
    collectedThisMonthPkr: collectedThisMonth[0]?.total ?? 0,
    mrrByCity,
    overdue: overdue.map((s) => ({
      subscriptionId: s._id,
      lastManualReminderAt: s.lastManualReminderAt,
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

/** How often the finance team can remind one business by hand. */
const MANUAL_REMINDER_GAP_MS = DAY_MS;

/**
 * Emails the owners of an overdue business about what they owe, on top of
 * the automatic reminders. At most once a day per business.
 */
export async function sendPaymentReminder(actorUserId: string, businessId: string) {
  const subscription = await Subscription.findOne({ businessId });
  if (!subscription) throw ApiError.notFound("No subscription for this business");
  if (
    subscription.status !== SUBSCRIPTION_STATUS.PAST_DUE &&
    subscription.status !== SUBSCRIPTION_STATUS.SUSPENDED
  ) {
    throw ApiError.badRequest("Only an overdue business can be reminded.");
  }

  const now = new Date();
  const claimed = await Subscription.updateOne(
    {
      _id: subscription._id,
      $or: [
        { lastManualReminderAt: null },
        { lastManualReminderAt: { $lte: new Date(now.getTime() - MANUAL_REMINDER_GAP_MS) } },
      ],
    },
    { $set: { lastManualReminderAt: now } },
  );
  if (claimed.modifiedCount !== 1) {
    throw ApiError.conflict("A reminder already went to this business in the last 24 hours.");
  }

  const invoice = await findOpenInvoice(subscription._id);
  const suspended = subscription.status === SUBSCRIPTION_STATUS.SUSPENDED;
  const opening = suspended
    ? "Stamping is paused at your business because payment has not arrived."
    : `Your payment is overdue.${
        subscription.graceEndsAt
          ? ` Stamping stops on ${day(subscription.graceEndsAt)} unless it arrives.`
          : ""
      }`;
  const body = invoice
    ? await invoiceEmail(invoice.number, invoice.totalPkr, invoice.dueDate)
    : `Please pay PKR ${renewalPrice(subscription).toLocaleString("en-PK")}. See Billing in your dashboard for how to pay.`;

  await emailOwners(
    businessId,
    suspended
      ? "Reminder: pay to switch TapTapSell back on"
      : "Reminder: your TapTapSell payment is overdue",
    `${opening}

${body}`,
  );
  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_REMINDER_SENT,
    resourceType: "Subscription",
    resourceId: subscription._id,
    metadata: { invoice: invoice?.number ?? null },
  });

  return { sentAt: now };
}
