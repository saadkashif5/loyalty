import {
  Business,
  Counter,
  Invoice,
  Subscription,
  type InvoiceDocument,
  type SubscriptionDocument,
} from "@/models";
import { INVOICE_STATUS } from "@/models/Invoice";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { SUBSCRIPTION_STATUS, type BillingCycle } from "@taptapsell/constants";
import { getBillingSettings } from "./settings.service";
import { addPeriods } from "./billing.config";

/** Pakistan's fiscal year runs 1 July – 30 June: "2026-27". */
export function fiscalYear(date: Date): string {
  const local = new Date(date.getTime() + 5 * 3_600_000);
  const year = local.getUTCFullYear();
  const start = local.getUTCMonth() >= 6 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** Gap-free numbering per fiscal year, safe under concurrency. */
async function nextInvoiceNumber(prefix: string, date: Date): Promise<string> {
  const fy = fiscalYear(date);
  const counter = await Counter.findOneAndUpdate(
    { _id: `invoice:${fy}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `${prefix}-${fy}-${String(counter.seq).padStart(5, "0")}`;
}

export function periodPrice(subscription: {
  plan: { priceMonthlyPkr: number; priceAnnualPkr: number };
  billingCycle: string;
}) {
  return subscription.billingCycle === "ANNUAL"
    ? subscription.plan.priceAnnualPkr
    : subscription.plan.priceMonthlyPkr;
}

/** Where the next paid period starts: after any remaining paid time or trial, else today. */
export function nextPeriodStart(subscription: SubscriptionDocument, now: Date = new Date()): Date {
  const candidates = [now];
  if (subscription.currentPeriodEnd) candidates.push(subscription.currentPeriodEnd);
  if (subscription.status === SUBSCRIPTION_STATUS.TRIALING && subscription.trialEndsAt) {
    candidates.push(subscription.trialEndsAt);
  }
  return candidates.reduce((latest, d) => (d > latest ? d : latest));
}

export async function findOpenInvoice(subscriptionId: unknown) {
  return Invoice.findOne({ subscriptionId, status: INVOICE_STATUS.ISSUED }).sort({ issuedAt: -1 });
}

function formatDay(d: Date) {
  return d.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" });
}

/**
 * Bills the next period(s). A business has at most one open invoice: asking
 * again returns it. Discount and tax are applied in whole rupees. A total of
 * zero (a complimentary account) settles itself straight away.
 */
export async function issueInvoice(
  subscription: SubscriptionDocument,
  options: { periods?: number; actorUserId?: string | null } = {},
): Promise<InvoiceDocument> {
  const open = await findOpenInvoice(subscription._id);
  if (open) return open;

  const now = new Date();
  const periods = options.periods ?? 1;
  const cycle = subscription.billingCycle as BillingCycle;
  const periodStart = nextPeriodStart(subscription, now);
  const periodEnd = addPeriods(periodStart, cycle, periods);

  const [settings, business] = await Promise.all([
    getBillingSettings(),
    Business.findById(subscription.businessId).select("name contact"),
  ]);

  const unitPkr = periodPrice(subscription);
  const subtotalPkr = unitPkr * periods;
  const discountPercent = subscription.discountPercent ?? 0;
  const discountPkr = Math.round((subtotalPkr * discountPercent) / 100);
  const taxable = subtotalPkr - discountPkr;
  const taxRatePercent = settings.taxRatePercent ?? 0;
  const taxPkr = Math.round((taxable * taxRatePercent) / 100);

  const invoice = await Invoice.create({
    number: await nextInvoiceNumber(settings.invoicePrefix ?? "TTS", now),
    businessId: subscription.businessId,
    subscriptionId: subscription._id,
    issuedAt: now,
    // Due before the service it pays for; an overdue period is due now.
    dueDate: periodStart > now ? periodStart : now,
    periodStart,
    periodEnd,
    periods,
    billingCycle: cycle,
    planCode: subscription.plan.code,
    lines: [
      {
        description: `${subscription.plan.name} plan, ${cycle === "ANNUAL" ? "yearly" : "monthly"}: ${formatDay(periodStart)} to ${formatDay(periodEnd)}`,
        quantity: periods,
        unitPkr,
        amountPkr: subtotalPkr,
      },
    ],
    subtotalPkr,
    discountPercent,
    discountPkr,
    taxLabel: settings.taxLabel ?? "Sales tax",
    taxRatePercent,
    taxPkr,
    totalPkr: taxable + taxPkr,
    seller: {
      name: settings.companyName ?? "TapTapSell",
      address: settings.address,
      ntn: settings.ntn,
      strn: settings.strn,
      email: settings.email,
      phone: settings.phone,
    },
    buyer: {
      name: business?.name ?? "Customer",
      address: business?.contact?.address,
      email: business?.contact?.email,
      phone: business?.contact?.phone,
    },
  });

  await recordAudit({
    actorUserId: options.actorUserId ?? undefined,
    businessId: subscription.businessId,
    action: AUDIT_ACTIONS.INVOICE_ISSUED,
    resourceType: "Invoice",
    resourceId: invoice._id,
    metadata: { number: invoice.number, totalPkr: invoice.totalPkr },
  });

  if (invoice.totalPkr === 0) await settleInvoice(invoice, subscription, now);
  return invoice;
}

/**
 * Marks an invoice paid and extends the subscription to the end of its
 * period. Returns false if someone else settled or voided it first.
 */
export async function settleInvoice(
  invoice: InvoiceDocument,
  subscription: SubscriptionDocument,
  now: Date = new Date(),
): Promise<boolean> {
  const claimed = await Invoice.updateOne(
    { _id: invoice._id, status: INVOICE_STATUS.ISSUED },
    {
      $set: {
        status: INVOICE_STATUS.PAID,
        paidAt: now,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
      },
    },
  );
  if (claimed.modifiedCount !== 1) return false;
  invoice.status = INVOICE_STATUS.PAID;
  invoice.paidAt = now;

  const continuing =
    subscription.status === SUBSCRIPTION_STATUS.ACTIVE &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd > now;

  await Subscription.updateOne(
    { _id: subscription._id },
    {
      $set: {
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodStart: continuing ? subscription.currentPeriodStart : invoice.periodStart,
        currentPeriodEnd: invoice.periodEnd,
        graceEndsAt: null,
        suspendedAt: null,
        cancelledAt: null,
        lastReminderKey: null,
      },
    },
  );
  return true;
}

export async function voidInvoice(actorUserId: string, invoiceId: string, reason: string) {
  const invoice = await Invoice.findOneAndUpdate(
    { _id: invoiceId, status: INVOICE_STATUS.ISSUED },
    { $set: { status: INVOICE_STATUS.VOID, voidedAt: new Date(), voidReason: reason } },
    { new: true },
  );
  if (!invoice) throw ApiError.conflict("Only an unpaid invoice can be voided");

  await recordAudit({
    actorUserId,
    businessId: invoice.businessId,
    action: AUDIT_ACTIONS.INVOICE_VOIDED,
    resourceType: "Invoice",
    resourceId: invoice._id,
    metadata: { number: invoice.number, reason },
  });
  return invoice;
}

export async function listInvoices(businessId: string, limit = 24) {
  return Invoice.find({ businessId }).sort({ issuedAt: -1 }).limit(limit);
}

export async function getInvoice(invoiceId: string, businessId?: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, ...(businessId ? { businessId } : {}) });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  return invoice;
}
