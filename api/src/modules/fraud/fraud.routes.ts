import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { requireBusinessRole } from "@/middleware/requireBusinessRole";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import { reviewFraudFlagSchema } from "@taptapsell/validation";
import * as service from "./fraud.service";

// Mounted at /api/v1/businesses/:businessId/fraud-flags (the dashboard's Alerts).
const router = Router({ mergeParams: true });
const canReview = requireBusinessRole({ permission: BUSINESS_PERMISSIONS.FRAUD_REVIEW });

router.get(
  "/",
  canReview,
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "OPEN";
    sendSuccess(res, await service.listFlags({ businessId: req.businessId!, status }));
  }),
);

router.patch(
  "/:flagId",
  canReview,
  asyncHandler(async (req, res) => {
    const input = reviewFraudFlagSchema.parse(req.body);
    sendSuccess(
      res,
      await service.reviewFlag(req.businessId!, req.params.flagId, req.userId!, input),
    );
  }),
);

export default router;
