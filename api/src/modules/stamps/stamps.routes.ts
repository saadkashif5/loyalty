import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { requireIdempotencyKey } from "@/middleware/idempotency";
import { createRateLimiter } from "@/middleware/rateLimit";
import { createStampHandler, listMyStampsHandler } from "./stamps.controller";

const router = Router();

router.use(requireAuth);

// Tight limit on the stamping endpoint itself — a copied tag identifier must
// not translate into an unbounded stream of valid stamps (§14).
const stampRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

router.post("/", stampRateLimiter, requireIdempotencyKey, createStampHandler);
router.get("/me", listMyStampsHandler);

export default router;
