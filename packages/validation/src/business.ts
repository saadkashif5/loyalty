import { z } from "zod";

export const businessCategorySchema = z.enum([
  "CAFE",
  "RESTAURANT",
  "BAKERY",
  "SALON",
  "BARBER",
  "GYM",
  "RETAIL",
  "OTHER",
]);

export const createBusinessSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  logo: z.string().url().optional(),
  category: businessCategorySchema.default("OTHER"),
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().min(7).max(20).optional(),
      address: z.string().max(500).optional(),
      city: z.string().trim().min(1).max(80).optional(),
    })
    .optional(),
});
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export const updateBusinessSchema = createBusinessSchema.partial().extend({
  /** Most counter stamps one staff member can add in a day (Pakistan time). */
  staffDailyStampCap: z.number().int().min(1).max(1000).optional(),
});
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export const createBranchSchema = z.object({
  name: z.string().min(1).max(160),
  address: z.string().max(500).optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  contact: z.object({ phone: z.string().min(7).max(20).optional() }).optional(),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema
  .partial()
  .extend({ status: z.enum(["ACTIVE", "INACTIVE"]).optional() });
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MANAGER", "STAFF"]),
  branchIds: z.array(z.string()).optional(),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(["MANAGER", "STAFF"]).optional(),
  branchIds: z.array(z.string()).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
