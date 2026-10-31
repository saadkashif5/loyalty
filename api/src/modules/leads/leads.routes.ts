import { Router } from "express";
import { createRateLimiter } from "@/middleware/rateLimit";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { createLeadSchema } from "@taptapsell/validation";
import * as service from "./leads.service";

// Mounted at /api/v1/leads. Public "request access" form on the marketing site.
// TODO(Phase 4): add a CAPTCHA (e.g. Turnstile) once the marketing site exists.
const router = Router();

const leadRateLimiter = createRateLimiter({ name: "leads", windowMs: 60_000, max: 5 });

router.post(
  "/",
  leadRateLimiter,
  asyncHandler(async (req, res) => {
    const input = createLeadSchema.parse(req.body);
    sendSuccess(res, await service.createLead(input), { status: 201 });
  }),
);

export default router;
