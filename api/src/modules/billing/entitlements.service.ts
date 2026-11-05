import { Types, type ClientSession } from "mongoose";
import {
  Branch,
  BusinessMember,
  LoyaltyCard,
  LoyaltyProgram,
  NfcDevice,
  Subscription,
} from "@/models";
import { ApiError } from "@/utils/ApiError";
import {
  BUSINESS_ROLES,
  DEVICE_STATUS,
  MEMBER_STATUS,
  PLAN_FEATURE_LABELS,
  PROGRAM_STATUS,
  type PlanFeature,
} from "@taptapsell/constants";

export type LimitedResource = "branches" | "programs" | "stampers" | "staff" | "customers";

const LABELS: Record<LimitedResource, [singular: string, plural: string]> = {
  branches: ["branch", "branches"],
  programs: ["active loyalty program", "active loyalty programs"],
  stampers: ["active stamper", "active stampers"],
  staff: ["staff member", "staff members"],
  customers: ["loyalty customer", "loyalty customers"],
};

/** How much of each limited resource a business uses now. */
export async function countUsage(businessId: string) {
  const [branches, programs, stampers, staff, customers] = await Promise.all([
    Branch.countDocuments({ businessId, status: "ACTIVE" }),
    LoyaltyProgram.countDocuments({ businessId, status: PROGRAM_STATUS.ACTIVE }),
    NfcDevice.countDocuments({ businessId, status: DEVICE_STATUS.ACTIVE }),
    BusinessMember.countDocuments({
      businessId,
      role: { $ne: BUSINESS_ROLES.OWNER },
      status: { $ne: MEMBER_STATUS.DISABLED },
    }),
    LoyaltyCard.aggregate<{ n: number }>([
      { $match: { businessId: new Types.ObjectId(businessId) } },
      { $group: { _id: "$customerId" } },
      { $count: "n" },
    ]).then((rows) => rows[0]?.n ?? 0),
  ]);
  return { branches, programs, stampers, staff, customers };
}

async function usageOf(businessId: string, resource: LimitedResource): Promise<number> {
  return (await countUsage(businessId))[resource];
}

/**
 * Refuses an action that would take the business past its plan. Businesses
 * without a subscription (created before billing, demo data) have no limits.
 * `customers` gets a customer-facing message; the rest speak to the owner.
 */
export async function assertWithinPlan(
  businessId: string,
  resource: LimitedResource,
  session?: ClientSession,
): Promise<void> {
  const subscription = await Subscription.findOne({ businessId })
    .select("plan.name plan.limits")
    .session(session ?? null);
  const limit = subscription?.plan?.limits?.[resource];
  if (limit === null || limit === undefined) return;

  const used = await usageOf(businessId, resource);
  if (used < limit) return;

  if (resource === "customers") {
    throw new ApiError(
      403,
      "PLAN_LIMIT",
      "This shop is not taking new loyalty members right now. Please ask the staff.",
    );
  }
  const [singular, plural] = LABELS[resource];
  throw new ApiError(
    403,
    "PLAN_LIMIT",
    `Your ${subscription?.plan?.name ?? "current"} plan allows ${limit} ${limit === 1 ? singular : plural}. Upgrade your plan to add more.`,
  );
}

/** Whether the business's plan includes a feature. No subscription, or an older snapshot: yes. */
export async function hasFeature(businessId: string, feature: PlanFeature): Promise<boolean> {
  const subscription = await Subscription.findOne({ businessId }).select("plan.flags");
  const flags = subscription?.plan?.flags as Partial<Record<PlanFeature, boolean>> | undefined;
  return flags?.[feature] !== false;
}

export async function assertFeature(businessId: string, feature: PlanFeature): Promise<void> {
  if (await hasFeature(businessId, feature)) return;
  throw new ApiError(
    403,
    "PLAN_FEATURE",
    `${PLAN_FEATURE_LABELS[feature]} is not in your plan. Upgrade your plan to use it.`,
  );
}

/** Every flag for the business, for the dashboard to show or hide screens. */
export async function featuresOf(businessId: string): Promise<Record<PlanFeature, boolean>> {
  const subscription = await Subscription.findOne({ businessId }).select("plan.flags");
  const flags = (subscription?.plan?.flags ?? {}) as Partial<Record<PlanFeature, boolean>>;
  return {
    counterMode: flags.counterMode !== false,
    welcomeStamp: flags.welcomeStamp !== false,
    stampExpiry: flags.stampExpiry !== false,
  };
}
