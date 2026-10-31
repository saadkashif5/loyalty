import { Plan } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import type { CreatePlanInput, UpdatePlanInput } from "@taptapsell/validation";

// ROADMAP §7 placeholder prices (PKR, excluding tax). Created once, then
// edited by the platform team in the console; annual = 10 months' price.
const DEFAULT_PLANS: CreatePlanInput[] = [
  {
    code: "STARTER",
    name: "Starter",
    description: "One shop getting started with loyalty.",
    priceMonthlyPkr: 2999,
    priceAnnualPkr: 29990,
    limits: { branches: 1, programs: 1, stampers: 1, staff: 3, customers: 1000 },
    features: ["Basic analytics", "WhatsApp support (business hours)"],
    isPublic: true,
    sortOrder: 10,
  },
  {
    code: "GROWTH",
    name: "Growth",
    description: "A busy shop or a few branches.",
    priceMonthlyPkr: 7999,
    priceAnnualPkr: 79990,
    limits: { branches: 3, programs: 3, stampers: 3, staff: 10, customers: 5000 },
    features: ["Full analytics and CSV export", "Fraud alerts", "Priority support"],
    isPublic: true,
    sortOrder: 20,
  },
  {
    code: "PRO",
    name: "Pro",
    description: "Multi-branch businesses.",
    priceMonthlyPkr: 19999,
    priceAnnualPkr: 199990,
    limits: { branches: 10, programs: null, stampers: 10, staff: null, customers: 25000 },
    features: ["Branch comparison", "Dedicated contact"],
    isPublic: true,
    sortOrder: 30,
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "Chains with custom terms. Price agreed per contract.",
    priceMonthlyPkr: 0,
    priceAnnualPkr: 0,
    limits: { branches: null, programs: null, stampers: null, staff: null, customers: null },
    features: ["Custom reports", "SLA"],
    isPublic: false,
    sortOrder: 40,
  },
];

/** Creates the default plans the first time billing is used. Safe to call repeatedly. */
export async function ensureDefaultPlans(): Promise<void> {
  if ((await Plan.estimatedDocumentCount()) > 0) return;
  await Plan.bulkWrite(
    DEFAULT_PLANS.map((plan) => ({
      updateOne: { filter: { code: plan.code }, update: { $setOnInsert: plan }, upsert: true },
    })),
  );
}

export async function listPlans(options: { publicOnly?: boolean } = {}) {
  await ensureDefaultPlans();
  const filter = options.publicOnly ? { isActive: true, isPublic: true } : {};
  return Plan.find(filter).sort({ sortOrder: 1, createdAt: 1 });
}

export async function findActivePlan(code: string) {
  await ensureDefaultPlans();
  const plan = await Plan.findOne({ code: code.toUpperCase(), isActive: true });
  if (!plan) throw ApiError.badRequest(`There is no active plan called ${code}`);
  return plan;
}

export async function createPlan(actorUserId: string, input: CreatePlanInput) {
  if (await Plan.exists({ code: input.code })) {
    throw ApiError.conflict("A plan with this code already exists");
  }
  const plan = await Plan.create(input);
  await recordAudit({
    actorUserId,
    action: AUDIT_ACTIONS.PLAN_CREATED,
    resourceType: "Plan",
    resourceId: plan._id,
    metadata: { code: plan.code },
  });
  return plan;
}

/** Every change bumps the version; businesses already on the plan keep their copy. */
export async function updatePlan(actorUserId: string, planId: string, input: UpdatePlanInput) {
  const plan = await Plan.findByIdAndUpdate(
    planId,
    { $set: input, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (!plan) throw ApiError.notFound("Plan not found");

  await recordAudit({
    actorUserId,
    action: AUDIT_ACTIONS.PLAN_UPDATED,
    resourceType: "Plan",
    resourceId: planId,
    metadata: { code: plan.code, version: plan.version, fields: Object.keys(input) },
  });
  return plan;
}
