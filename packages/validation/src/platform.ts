import { z } from "zod";
import { businessCategorySchema, createBusinessSchema } from "./business";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

/**
 * Pakistani mobile number, normalised to E.164 (+923XXXXXXXXX). Accepts the
 * forms people actually type: 03001234567, +92 300 1234567, 923001234567.
 */
export const pakistanMobileSchema = z
  .string()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .pipe(
    z.string().regex(/^(?:\+92|92|0)3\d{9}$/, "Enter a Pakistani mobile number, e.g. 0300 1234567"),
  )
  .transform((v) => `+92${v.slice(-10)}`);

// ---- Two-step verification ----------------------------------------------

export const mfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});
export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;

export const mfaLoginSchema = z
  .object({
    mfaToken: z.string().min(1),
    code: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    recoveryCode: z.string().min(8).max(20).optional(),
  })
  .refine((d) => Boolean(d.code) !== Boolean(d.recoveryCode), {
    message: "Provide either a code or a recovery code",
  });
export type MfaLoginInput = z.infer<typeof mfaLoginSchema>;

// ---- Business onboarding by the platform -------------------------------

export const createBusinessWithOwnerSchema = z.object({
  business: createBusinessSchema,
  owner: z.object({
    name: z.string().min(1).max(120),
    email: z.email(),
    phone: pakistanMobileSchema.optional(),
  }),
  /** Lead this business came from, if any; marked converted. */
  leadId: objectId.optional(),
  /** Plan the business starts on, and its free trial (counted from when the owner accepts). */
  planCode: z.string().trim().toUpperCase().min(2).max(31).default("STARTER"),
  trialDays: z.number().int().min(0).max(90).default(30),
});
export type CreateBusinessWithOwnerInput = z.infer<typeof createBusinessWithOwnerSchema>;

export const acceptInvitationSchema = z.object({
  /** Required when the invitee has no account yet. */
  password: z.string().min(8).max(128).optional(),
  name: z.string().min(1).max(120).optional(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

// ---- Leads ("request access") --------------------------------------------

export const LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "REJECTED"] as const;

export const createLeadSchema = z.object({
  businessName: z.string().min(1).max(160),
  contactName: z.string().min(1).max(120),
  phone: pakistanMobileSchema,
  email: z.email().optional(),
  city: z.string().min(1).max(80),
  category: businessCategorySchema,
  branches: z.number().int().min(1).max(1000).optional(),
  message: z.string().max(1000).optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  note: z.string().min(1).max(1000).optional(),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

// ---- Platform team ---------------------------------------------------------

const platformRoleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "SUPPORT", "FINANCE"]);

export const addTeamMemberSchema = z.object({
  email: z.email(),
  platformRole: platformRoleSchema,
});
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;

export const updateTeamMemberSchema = z.object({
  /** null removes the user from the platform team. */
  platformRole: platformRoleSchema.nullable(),
});
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
