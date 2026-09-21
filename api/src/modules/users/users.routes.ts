import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { getMeHandler } from "./users.controller";

const router = Router();

router.get("/me", requireAuth, getMeHandler);

export default router;
