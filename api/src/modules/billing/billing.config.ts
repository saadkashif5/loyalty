// Billing rules in one place (ROADMAP Phase 3). Candidates for platform
// settings in the console once the team wants to change them without a release.

export const DAY_MS = 86_400_000;

/** Days an unpaid business keeps working after its trial or period ends. */
export const GRACE_DAYS = 7;

/** A business suspended for non-payment this long is cancelled. */
export const CANCEL_AFTER_SUSPENDED_DAYS = 90;

/** Customers can still redeem rewards they earned for this long after a billing suspension. */
export const REDEEM_DURING_BILLING_SUSPENSION_DAYS = 30;

/** The next invoice is issued this many days before a trial or period ends. */
export const INVOICE_LEAD_DAYS = 7;

/** Owners are reminded this many days before a trial or period ends. */
export const REMIND_BEFORE_DAYS = 3;

/** Adds whole months (or years), keeping the day of the month where possible. */
export function addPeriods(from: Date, cycle: "MONTHLY" | "ANNUAL", periods: number): Date {
  const date = new Date(from);
  const months = cycle === "ANNUAL" ? 12 * periods : periods;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  // 31 January + 1 month is 28/29 February, not 3 March.
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

/** Monthly recurring revenue contribution of one subscription, in PKR. */
export function monthlyValue(
  plan: { priceMonthlyPkr: number; priceAnnualPkr: number },
  cycle: string,
) {
  return cycle === "ANNUAL" ? Math.round(plan.priceAnnualPkr / 12) : plan.priceMonthlyPkr;
}
