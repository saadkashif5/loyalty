import { Router } from "express";
import { optionalAuth } from "@/middleware/auth";
import { createRateLimiter } from "@/middleware/rateLimit";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { acceptInvitationSchema } from "@taptapsell/validation";
import * as service from "./invitations.service";

// Mounted at /api/v1/invitations. Used by the invitee from the link they were
// sent; the token in the path is the only credential.
const router = Router();

const invitationRateLimiter = createRateLimiter({ name: "invitations", windowMs: 60_000, max: 20 });

router.get(
  "/:token",
  invitationRateLimiter,
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.getInvitationForInvitee(req.params.token));
  }),
);

router.post(
  "/:token/accept",
  invitationRateLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const input = acceptInvitationSchema.parse(req.body ?? {});
    const result = await service.acceptInvitation(
      req.params.token,
      input,
      req.userId,
      { userAgent: req.clientUserAgent, ip: req.clientIp },
      req.sessionId,
    );
    sendSuccess(res, result, { status: 201 });
  }),
);

export default router;
