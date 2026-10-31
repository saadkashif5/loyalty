import { Router } from "express";
import { createRateLimiter } from "@/middleware/rateLimit";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { recordTapSchema } from "@taptapsell/validation";
import * as service from "./taps.service";

// Mounted at /api/v1/taps. Called by the portal page a stamper URL opens.
const router = Router();

const tapRateLimiter = createRateLimiter({ name: "taps", windowMs: 60_000, max: 30 });

router.post(
  "/",
  tapRateLimiter,
  asyncHandler(async (req, res) => {
    const input = recordTapSchema.parse(req.body);
    sendSuccess(res, await service.recordTap(input), { status: 201 });
  }),
);

export default router;
