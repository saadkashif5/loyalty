import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { requireIdempotencyKey } from "@/middleware/idempotency";
import {
  listMyRedemptionsHandler,
  getMyRedemptionHandler,
  requestRedemptionHandler,
} from "./redemptions.controller";

// Customer-facing redemption routes. Staff validation lives under the
// business-scoped router so it can be permission-gated.
const router = Router();

router.use(requireAuth);

router.get("/me", listMyRedemptionsHandler);
router.get("/:redemptionId", getMyRedemptionHandler);
router.post("/", requireIdempotencyKey, requestRedemptionHandler);

export default router;
