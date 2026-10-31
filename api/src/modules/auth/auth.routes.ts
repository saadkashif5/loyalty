import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { createRateLimiter } from "@/middleware/rateLimit";
import {
  registerHandler,
  loginHandler,
  mfaLoginHandler,
  refreshHandler,
  logoutHandler,
  mfaSetupHandler,
  mfaEnableHandler,
  mfaDisableHandler,
  mfaStatusHandler,
  listSessionsHandler,
  revokeSessionHandler,
  revokeOtherSessionsHandler,
} from "./auth.controller";

const router = Router();

// Stricter limits on credential-guessing-prone routes (§14, §30).
const authRateLimiter = createRateLimiter({ name: "auth", windowMs: 60_000, max: 10 });

router.post("/register", authRateLimiter, registerHandler);
router.post("/login", authRateLimiter, loginHandler);
router.post("/login/mfa", authRateLimiter, mfaLoginHandler);
router.post("/refresh", authRateLimiter, refreshHandler);
router.post("/logout", logoutHandler);

// Two-step verification for the signed-in user.
router.get("/mfa", requireAuth, mfaStatusHandler);
router.post("/mfa/setup", requireAuth, authRateLimiter, mfaSetupHandler);
router.post("/mfa/enable", requireAuth, authRateLimiter, mfaEnableHandler);
router.post("/mfa/disable", requireAuth, authRateLimiter, mfaDisableHandler);

// Where the user is signed in, and remote sign-out.
router.get("/sessions", requireAuth, listSessionsHandler);
router.post("/sessions/revoke-others", requireAuth, revokeOtherSessionsHandler);
router.delete("/sessions/:sessionId", requireAuth, revokeSessionHandler);

export default router;
