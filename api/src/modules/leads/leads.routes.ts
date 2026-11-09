import { Router } from "express";
import { createRateLimiter } from "@/middleware/rateLimit";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { createLeadSchema } from "@taptapsell/validation";
import * as service from "./leads.service";

// Mounted at /api/v1/leads. Public "request access" form on the marketing site.
// Bots are kept out by a rate limit and a hidden "website" field people never
// fill in; a CAPTCHA can be added if spam gets through.
const router = Router();

const leadRateLimiter = createRateLimiter({ name: "leads", windowMs: 60_000, max: 5 });

router.post(
  "/",
  leadRateLimiter,
  asyncHandler(async (req, res) => {
    // Filled in only by bots: answer as if it worked and keep nothing.
    if (typeof req.body?.website === "string" && req.body.website.trim()) {
      sendSuccess(res, { received: true }, { status: 201 });
      return;
    }
    const input = createLeadSchema.parse(req.body);
    sendSuccess(res, await service.createLead(input), { status: 201 });
  }),
);

export default router;
