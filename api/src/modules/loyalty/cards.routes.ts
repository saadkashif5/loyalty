import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { joinProgramHandler, listMyCardsHandler, getMyCardHandler } from "./cards.controller";

// Customer-facing loyalty card routes (/api/v1/loyalty-cards).
const router = Router();

router.use(requireAuth);

router.post("/join", joinProgramHandler);
router.get("/", listMyCardsHandler);
router.get("/:cardId", getMyCardHandler);

export default router;
