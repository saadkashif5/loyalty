import type { BillingCycle } from "@taptapsell/constants";
import { DAY_MS } from "./billing.config";

type LimitKey = "branches" | "programs" | "stampers" | "staff";
type Limits = Partial<Record<LimitKey | "customers", number | null>>;

interface PlanTerms {
  code: string;
  priceMonthlyPkr: number;
  priceAnnualPkr: number;
  limits?: Limits | null;
}

interface SubscriptionTerms {
  status: string;
  billingCycle: string;
  plan: PlanTerms;
  currentPeriodEnd?: Date | null;
}

export interface PlanChangeQuote {
  /**
   * CURRENT: nothing to change. NOW: no paid time left, so it applies at once.
   * PRORATED: applies at once, the difference goes on the next invoice.
   * PERIOD_END: applies when the paid period ends. CONTACT_TEAM: not self-service.
   */
  kind: "CURRENT" | "NOW" | "PRORATED" | "PERIOD_END" | "CONTACT_TEAM";
  chargePkr: number;
  effectiveAt: Date | null;
  /** Reasons the change is refused. */
  blockers: string[];
  /** Allowed, but the owner should know. */
  warnings: string[];
}

const USAGE_LABELS: Array<[LimitKey, string]> = [
  ["branches", "branches"],
  ["programs", "active programs"],
  ["stampers", "active stampers"],
  ["staff", "staff members"],
];

const AVERAGE_MONTH_MS = 30.44 * DAY_MS;

function price(plan: PlanTerms, cycle: string) {
  return cycle === "ANNUAL" ? plan.priceAnnualPkr : plan.priceMonthlyPkr;
}

/**
 * What moving to a plan would do. Paid time left decides: upgrades on monthly
 * billing start at once and the difference for the days left is charged on the
 * next invoice; anything cheaper, and any change of cycle, waits for the end of
 * the paid period. Annual upgrades go through the team: the difference can be
 * large and the next invoice up to a year away.
 */
export function quotePlanChange(
  subscription: SubscriptionTerms,
  target: PlanTerms,
  cycle: BillingCycle,
  usage: Record<LimitKey | "customers", number>,
  now: Date = new Date(),
): PlanChangeQuote {
  if (target.code === subscription.plan.code && cycle === subscription.billingCycle) {
    return { kind: "CURRENT", chargePkr: 0, effectiveAt: null, blockers: [], warnings: [] };
  }

  const blockers: string[] = [];
  for (const [key, label] of USAGE_LABELS) {
    const limit = target.limits?.[key];
    if (limit !== null && limit !== undefined && usage[key] > limit) {
      blockers.push(`You have ${usage[key]} ${label}; this plan allows ${limit}.`);
    }
  }
  const customerLimit = target.limits?.customers;
  const warnings =
    customerLimit !== null && customerLimit !== undefined && usage.customers >= customerLimit
      ? [
          `You have ${usage.customers} loyalty customers; this plan allows ${customerLimit}. Existing cards keep working, but new customers cannot join.`,
        ]
      : [];
  const base = { chargePkr: 0, blockers, warnings };

  const paidUntil =
    subscription.status === "ACTIVE" &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd > now
      ? subscription.currentPeriodEnd
      : null;
  if (!paidUntil) return { ...base, kind: "NOW", effectiveAt: now };

  const oldPrice = price(subscription.plan, subscription.billingCycle);
  const newPrice = price(target, cycle);
  if (cycle !== subscription.billingCycle || newPrice <= oldPrice) {
    return { ...base, kind: "PERIOD_END", effectiveAt: paidUntil };
  }
  if (cycle === "ANNUAL") return { ...base, kind: "CONTACT_TEAM", effectiveAt: null };

  // Months left, not a fraction of the period: several months may be paid ahead.
  const monthsLeft = (paidUntil.getTime() - now.getTime()) / AVERAGE_MONTH_MS;
  return {
    ...base,
    kind: "PRORATED",
    effectiveAt: now,
    chargePkr: Math.round((newPrice - oldPrice) * monthsLeft),
  };
}
