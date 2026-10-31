import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const registerDeviceSchema = z.object({
  deviceType: z.enum(["NFC_TAG", "NFC_PUCK", "STICKER", "OTHER"]).default("NFC_TAG"),
  tagType: z.enum(["STATIC", "NTAG21X_MIRROR"]).default("NTAG21X_MIRROR"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  quantity: z.number().int().min(1).max(100).default(1),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const assignDeviceSchema = z.object({
  businessId: objectId,
  branchId: objectId,
});
export type AssignDeviceInput = z.infer<typeof assignDeviceSchema>;

export const activateDeviceSchema = z.object({
  deviceIdentifier: z.string().min(4).max(32),
  activationCode: z.string().min(4).max(32),
  branchId: objectId,
});
export type ActivateDeviceInput = z.infer<typeof activateDeviceSchema>;

// A tap as it arrives from the stamper URL. `params` are the query parameters
// the chip wrote into the URL (e.g. NTAG21x `m=<UID>x<counter>`); each tag
// type's verifier decides what they must contain.
export const recordTapSchema = z.object({
  deviceIdentifier: z.string().min(4).max(32),
  params: z.record(z.string(), z.string().max(256)).default({}),
});
export type RecordTapInput = z.infer<typeof recordTapSchema>;

export const revokeDeviceSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type RevokeDeviceInput = z.infer<typeof revokeDeviceSchema>;
