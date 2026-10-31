import { z } from "zod";

const limit = z.number().int().min(0).max(1_000_000).nullable();

/** null means unlimited. */
export const planLimitsSchema = z.object({
  branches: limit,
  programs: limit,
  stampers: limit,
  staff: limit,
  customers: limit,
});
export type PlanLimits = z.infer<typeof planLimitsSchema>;

export const createPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,30}$/, "Use capital letters, digits and underscores"),
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
  priceMonthlyPkr: z.number().int().min(0).max(10_000_000),
  priceAnnualPkr: z.number().int().min(0).max(100_000_000),
  limits: planLimitsSchema,
  features: z.array(z.string().max(80)).max(20).default([]),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(100),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = createPlanSchema.omit({ code: true }).partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const changeSubscriptionPlanSchema = z.object({
  planCode: z.string().trim().toUpperCase().min(2).max(31),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
});
export type ChangeSubscriptionPlanInput = z.infer<typeof changeSubscriptionPlanSchema>;

export const extendTrialSchema = z.object({
  days: z.number().int().min(1).max(90),
});
export type ExtendTrialInput = z.infer<typeof extendTrialSchema>;

export const recordPaymentSchema = z.object({
  amountPkr: z.number().int().min(1).max(100_000_000),
  method: z.enum(["BANK_TRANSFER", "RAAST", "CASH", "CHEQUE", "CARD", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
  /** How many billing periods (months, or years on annual billing) this pays for. */
  periods: z.number().int().min(1).max(24).default(1),
  note: z.string().max(500).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
