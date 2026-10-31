import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { createRateLimiter } from "@/middleware/rateLimit";
import { joinProgramHandler, listMyCardsHandler, getMyCardHandler } from "./cards.controller";
import { issueCounterCodeHandler } from "@/modules/counter/counter.controller";

// Customer-facing loyalty card routes (/api/v1/loyalty-cards).
const router = Router();

router.use(requireAuth);

router.post("/join", joinProgramHandler);
router.get("/", listMyCardsHandler);
router.get("/:cardId", getMyCardHandler);

// The code shown at the counter; the card page asks for it about once a minute.
const counterCodeLimiter = createRateLimiter({ name: "counter-code", windowMs: 60_000, max: 20 });
router.post("/:cardId/counter-code", counterCodeLimiter, issueCounterCodeHandler);

export default router;
