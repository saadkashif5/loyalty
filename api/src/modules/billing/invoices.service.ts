import {
  Business,
  Counter,
  Invoice,
  Subscription,
  type InvoiceDocument,
  type SubscriptionDocument,
} from "@/models";
import { INVOICE_STATUS } from "@/models/Invoice";
import { CHARGE_KIND } from "@/models/Subscription";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { SUBSCRIPTION_STATUS, type BillingCycle } from "@taptapsell/constants";
import { getBillingSettings } from "./settings.service";
import { addPeriods } from "./billing.config";
import { BRAND } from "@taptapsell/brand";

/** Pakistan's fiscal year runs 1 July – 30 June: "2026-27". */
export function fiscalYear(date: Date): string {
  const local = new Date(date.getTime() + 5 * 3_600_000);
  const year = local.getUTCFullYear();
  const start = local.getUTCMonth() >= 6 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** Gap-free numbering per fiscal year, safe under concurrency. */
async function nextInvoiceNumber(prefix: string, date: Date): Promise<string> {
  return nextDocumentNumber("invoice", prefix, date);
}

/** Gap-free numbering per kind of document and fiscal year: TTS-2026-27-00001. */
export async function nextDocumentNumber(kind: string, prefix: string, date: Date) {
  const fy = fiscalYear(date);
  const counter = await Counter.findOneAndUpdate(
    { _id: `${kind}:${fy}` },
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

/** The plan and cycle a period starting at `from` is billed on, counting any scheduled change. */
function termsFor(subscription: SubscriptionDocument, from: Date) {
  const scheduled = subscription.scheduledChange;
  if (scheduled && from >= scheduled.effectiveAt) {
    return { plan: scheduled.plan, billingCycle: scheduled.billingCycle };
  }
  return { plan: subscription.plan, billingCycle: subscription.billingCycle };
}

/** What the next renewal costs before tax, on the plan the business will be on by then. */
export function renewalPrice(subscription: SubscriptionDocument) {
  return periodPrice(termsFor(subscription, nextPeriodStart(subscription)));
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
 * Bills the next period(s) plus any pending charges. A business has at most
 * one open invoice: asking again returns it. Discount and tax are applied in
 * whole rupees; hardware is never discounted. A total of zero (a complimentary
 * account) settles itself straight away.
 */
export async function issueInvoice(
  subscription: SubscriptionDocument,
  options: { periods?: number; actorUserId?: string | null } = {},
): Promise<InvoiceDocument> {
  const open = await findOpenInvoice(subscription._id);
  if (open) return open;

  const now = new Date();
  const periods = options.periods ?? 1;
  const periodStart = nextPeriodStart(subscription, now);
  const terms = termsFor(subscription, periodStart);
  const cycle = terms.billingCycle as BillingCycle;
  const periodEnd = addPeriods(periodStart, cycle, periods);

  const [settings, business] = await Promise.all([
    getBillingSettings(),
    Business.findById(subscription.businessId).select("name contact"),
  ]);

  const unitPkr = periodPrice(terms);
  const charges = subscription.pendingCharges;
  const planPkr = unitPkr * periods;
  const hardwarePkr = charges
    .filter((c) => c.kind === CHARGE_KIND.HARDWARE)
    .reduce((sum, c) => sum + c.amountPkr, 0);
  const subtotalPkr = planPkr + charges.reduce((sum, c) => sum + c.amountPkr, 0);
  const discountable = subtotalPkr - hardwarePkr;
  const discountPercent = subscription.discountPercent ?? 0;
  const discountPkr = Math.round((discountable * discountPercent) / 100);
  // A coupon comes off what is left of the plan part after the standing discount.
  const coupon = subscription.coupon?.invoicesLeft ? subscription.coupon : null;
  const couponBase = discountable - discountPkr;
  const couponPkr = coupon
    ? Math.min(
        couponBase,
        coupon.percentOff
          ? Math.round((couponBase * coupon.percentOff) / 100)
          : (coupon.amountOffPkr ?? 0),
      )
    : 0;
  const taxable = subtotalPkr - discountPkr - couponPkr;
  const taxRatePercent = settings.taxRatePercent ?? 0;
  const taxPkr = Math.round((taxable * taxRatePercent) / 100);
  // Credit notes kept as credit pay towards the total, tax included.
  const creditAppliedPkr = Math.min(subscription.creditBalancePkr ?? 0, taxable + taxPkr);

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
    planCode: terms.plan.code,
    lines: [
      {
        description: `${terms.plan.name} plan, ${cycle === "ANNUAL" ? "yearly" : "monthly"}: ${formatDay(periodStart)} to ${formatDay(periodEnd)}`,
        quantity: periods,
        unitPkr,
        amountPkr: planPkr,
      },
      ...charges.map((c) => ({
        description: c.description,
        quantity: c.quantity,
        unitPkr: c.unitPkr,
        amountPkr: c.amountPkr,
        chargeKind: c.kind,
      })),
    ],
    subtotalPkr,
    discountPercent,
    discountPkr,
    taxLabel: settings.taxLabel ?? "Sales tax",
    taxRatePercent,
    taxPkr,
    coupon: couponPkr
      ? {
          couponId: coupon!.couponId,
          code: coupon!.code,
          percentOff: coupon!.percentOff,
          amountOffPkr: coupon!.amountOffPkr,
          amountPkr: couponPkr,
        }
      : null,
    creditAppliedPkr,
    totalPkr: taxable + taxPkr - creditAppliedPkr,
    seller: {
      name: settings.companyName ?? BRAND.company,
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

  if (charges.length > 0) {
    await Subscription.updateOne(
      { _id: subscription._id },
      { $pull: { pendingCharges: { _id: { $in: charges.map((c) => c._id) } } } },
    );
  }
  if (couponPkr || creditAppliedPkr) {
    await Subscription.updateOne(
      { _id: subscription._id },
      {
        $inc: {
          ...(couponPkr ? { "coupon.invoicesLeft": -1 } : {}),
          creditBalancePkr: -creditAppliedPkr,
        },
      },
    );
    // A used-up coupon leaves the subscription.
    await Subscription.updateOne(
      { _id: subscription._id, "coupon.invoicesLeft": { $lte: 0 } },
      { $set: { coupon: null } },
    );
  }

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
  await returnCharges(invoice);

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

/**
 * What a voided invoice used goes back: charges are still owed, the coupon
 * use and any credit return to the subscription for the next invoice.
 */
async function returnCharges(invoice: InvoiceDocument) {
  if (invoice.creditAppliedPkr) {
    await Subscription.updateOne(
      { _id: invoice.subscriptionId },
      { $inc: { creditBalancePkr: invoice.creditAppliedPkr } },
    );
  }
  const used = invoice.coupon;
  if (used?.amountPkr) {
    const restored = await Subscription.updateOne(
      { _id: invoice.subscriptionId, "coupon.code": used.code },
      { $inc: { "coupon.invoicesLeft": 1 } },
    );
    if (restored.modifiedCount === 0) {
      await Subscription.updateOne(
        { _id: invoice.subscriptionId, coupon: null },
        {
          $set: {
            coupon: {
              couponId: used.couponId,
              code: used.code,
              percentOff: used.percentOff,
              amountOffPkr: used.amountOffPkr,
              invoicesLeft: 1,
            },
          },
        },
      );
    }
  }

  const charges = invoice.lines
    .filter((line) => line.chargeKind)
    .map((line) => ({
      kind: line.chargeKind,
      description: line.description,
      quantity: line.quantity,
      unitPkr: line.unitPkr,
      amountPkr: line.amountPkr,
    }));
  if (charges.length === 0) return;
  await Subscription.updateOne(
    { _id: invoice.subscriptionId },
    { $push: { pendingCharges: { $each: charges } } },
  );
}

/** Replaces the open invoice, if any, so it reflects the current plan and charges. */
export async function reissueOpenInvoice(
  subscription: SubscriptionDocument,
  actorUserId: string,
  reason: string,
) {
  const open = await findOpenInvoice(subscription._id);
  if (!open) return null;
  await voidInvoice(actorUserId, String(open._id), reason);
  const fresh = await Subscription.findById(subscription._id);
  return fresh ? issueInvoice(fresh, { periods: open.periods, actorUserId }) : null;
}

export async function listInvoices(businessId: string, limit = 24) {
  return Invoice.find({ businessId }).sort({ issuedAt: -1 }).limit(limit);
}

export async function getInvoice(invoiceId: string, businessId?: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, ...(businessId ? { businessId } : {}) });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  return invoice;
}
