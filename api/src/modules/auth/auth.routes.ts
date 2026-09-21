import { Router } from "express";
import { createRateLimiter } from "@/middleware/rateLimit";
import { registerHandler, loginHandler, refreshHandler, logoutHandler } from "./auth.controller";

const router = Router();

// Stricter limits on credential-guessing-prone routes (§14, §30).
const authRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

router.post("/register", authRateLimiter, registerHandler);
router.post("/login", authRateLimiter, loginHandler);
router.post("/refresh", authRateLimiter, refreshHandler);
router.post("/logout", logoutHandler);

export default router;
