import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { createRateLimiter } from "@/middleware/rateLimit";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { getMeHandler } from "./users.controller";
import { deleteAccount, exportAccount } from "./account.service";
import { listConsents, setWhatsappConsent, updateProfile } from "./profile.service";
import { updateProfileSchema } from "@taptapsell/validation";
import { isValidObjectId } from "mongoose";
import { ApiError } from "@/utils/ApiError";

const router = Router();

router.get("/me", requireAuth, getMeHandler);

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    sendSuccess(res, await updateProfile(req.userId!, updateProfileSchema.parse(req.body)));
  }),
);

// Which businesses may message the customer on WhatsApp; one switch per business.
router.get(
  "/me/consents",
  requireAuth,
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listConsents(req.userId!));
  }),
);

const consentSchema = z.object({ whatsapp: z.boolean() });
router.put(
  "/me/consents/:businessId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.businessId)) throw ApiError.notFound("Business not found");
    const { whatsapp } = consentSchema.parse(req.body);
    sendSuccess(res, await setWhatsappConsent(req.userId!, req.params.businessId, whatsapp));
  }),
);

// A download, not a page: a few per hour is plenty.
const exportLimiter = createRateLimiter({
  name: "account-export",
  windowMs: 60 * 60_000,
  max: 5,
  key: (req) => req.userId ?? req.clientIp,
});
router.get(
  "/me/export",
  requireAuth,
  exportLimiter,
  asyncHandler(async (req, res) => {
    const data = await exportAccount(req.userId!);
    res.setHeader("Content-Disposition", 'attachment; filename="taptapsell-my-data.json"');
    res.type("application/json").send(JSON.stringify(data, null, 2));
  }),
);

// Typed confirmation, so a stray request cannot delete an account.
const deleteSchema = z.object({ confirm: z.literal("DELETE") });
router.delete(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    deleteSchema.parse(req.body);
    await deleteAccount(req.userId!);
    sendSuccess(res, { deleted: true });
  }),
);

export default router;
