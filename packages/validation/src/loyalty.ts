import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const createProgramSchema = z
  .object({
    name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    requiredStamps: z.number().int().min(1).max(100),
    branches: z.array(objectId).optional(), // omitted/empty = all branches
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    branding: z.object({ color: z.string().optional(), icon: z.string().optional() }).optional(),
    terms: z.string().max(5000).optional(),
    /** Minimum minutes between two stamps on the same card. Anti-abuse (§14). */
    minMinutesBetweenStamps: z.number().int().min(0).max(1440).default(5),
  })
  .refine((data) => !data.endDate || !data.startDate || data.endDate > data.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });
export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  requiredStamps: z.number().int().min(1).max(100).optional(),
  branches: z.array(objectId).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  endDate: z.coerce.date().optional(),
  terms: z.string().max(5000).optional(),
  minMinutesBetweenStamps: z.number().int().min(0).max(1440).optional(),
});
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

export const createRewardSchema = z.object({
  programId: objectId,
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  type: z.enum(["FREE_ITEM", "PERCENT_OFF", "FIXED_DISCOUNT", "OTHER"]),
  value: z.record(z.string(), z.unknown()).optional(),
  requiredStamps: z.number().int().min(1).max(100),
  expiresAt: z.coerce.date().optional(),
  terms: z.string().max(5000).optional(),
  redemptionLimit: z.number().int().min(1).default(1),
});
export type CreateRewardInput = z.infer<typeof createRewardSchema>;

export const updateRewardSchema = createRewardSchema
  .partial()
  .omit({ programId: true })
  .extend({ status: z.enum(["ACTIVE", "INACTIVE"]).optional() });
export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;

export const joinProgramSchema = z.object({
  programId: objectId,
});
export type JoinProgramInput = z.infer<typeof joinProgramSchema>;

// Stamp requests carry only proof of a tap — never a stamp count or any claim
// about eligibility. The backend decides (§13.1, §54 Principle 3).
// A tap token comes from POST /taps; a bare device identifier is accepted only
// for STATIC stampers, which cannot prove a tap is fresh.
export const createStampSchema = z.union([
  z.object({
    tapToken: z.string().min(32).max(128),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    deviceIdentifier: z.string().min(4).max(32),
    source: z.enum(["NFC", "QR"]),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
]);
export type CreateStampInput = z.infer<typeof createStampSchema>;

// Staff-issued stamp; the customer is taken from the card, never from the body.
export const createManualStampSchema = z.object({
  loyaltyCardId: objectId,
  branchId: objectId,
});
export type CreateManualStampInput = z.infer<typeof createManualStampSchema>;

export const createRedemptionSchema = z.object({
  rewardId: objectId,
  loyaltyCardId: objectId,
});
export type CreateRedemptionInput = z.infer<typeof createRedemptionSchema>;

export const validateRedemptionSchema = z.object({
  redemptionCode: z.string().min(4).max(32),
  branchId: objectId.optional(),
});
export type ValidateRedemptionInput = z.infer<typeof validateRedemptionSchema>;
