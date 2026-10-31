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
  /** The invoice this settles; without it, the open invoice is used (or one is issued). */
  invoiceId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  amountPkr: z.number().int().min(1).max(100_000_000),
  method: z.enum(["BANK_TRANSFER", "RAAST", "CASH", "CHEQUE", "CARD", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
  /** How many billing periods (months, or years on annual billing) this pays for. */
  periods: z.number().int().min(1).max(24).default(1),
  note: z.string().max(500).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// ---- Invoices, settings and payment proofs -----------------------------------------

export const billingSettingsSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  address: z.string().trim().max(500).optional(),
  ntn: z.string().trim().max(20).optional(),
  strn: z.string().trim().max(20).optional(),
  email: z.email().optional(),
  phone: z.string().trim().max(30).optional(),
  taxLabel: z.string().trim().min(1).max(40).default("Sales tax"),
  taxRatePercent: z.number().min(0).max(50).default(0),
  invoicePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "2–10 letters or digits"),
  bankAccounts: z
    .array(
      z.object({
        bankName: z.string().trim().min(1).max(80),
        accountTitle: z.string().trim().min(1).max(120),
        accountNumber: z.string().trim().min(4).max(40),
        iban: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^PK\d{2}[A-Z]{4}\d{16}$/, "A Pakistani IBAN looks like PK36SCBL0000001123456702")
          .optional(),
      }),
    )
    .max(5)
    .default([]),
  raastId: z.string().trim().max(40).optional(),
  paymentInstructions: z.string().trim().max(1000).optional(),
});
export type BillingSettingsInput = z.infer<typeof billingSettingsSchema>;

export const issueInvoiceSchema = z.object({
  periods: z.number().int().min(1).max(24).default(1),
});
export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;

export const voidInvoiceSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;

export const setDiscountSchema = z.object({
  discountPercent: z.number().int().min(0).max(100),
});
export type SetDiscountInput = z.infer<typeof setDiscountSchema>;

/** Sent as multipart fields next to the uploaded file. */
export const uploadProofSchema = z.object({
  method: z.enum(["BANK_TRANSFER", "RAAST", "CHEQUE", "OTHER"]),
  amountPkr: z.coerce.number().int().min(1).max(100_000_000),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});
export type UploadProofInput = z.infer<typeof uploadProofSchema>;

export const rejectProofSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type RejectProofInput = z.infer<typeof rejectProofSchema>;
