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
  requestEmailCodeHandler,
  verifyEmailCodeHandler,
} from "./auth.controller";

const router = Router();

// Credential-guessing protection (§14, §30) is mainly per account and per
// sign-in challenge. Per-address limits stay generous: Pakistani mobile
// networks put very many customers behind one carrier-grade NAT address.
const authRateLimiter = createRateLimiter({ name: "auth", windowMs: 60_000, max: 30 });
const refreshRateLimiter = createRateLimiter({ name: "refresh", windowMs: 60_000, max: 120 });

// Failed passwords per account, from any number of addresses. Someone can
// still lock an account for 15 minutes on purpose; that is the usual trade-off.
const loginAccountLimiter = createRateLimiter({
  name: "login-account",
  windowMs: 15 * 60_000,
  max: 10,
  failuresOnly: true,
  key: (req) =>
    String(req.body?.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 254),
});

// Five code attempts per sign-in challenge; after that, start again with the password.
const mfaChallengeLimiter = createRateLimiter({
  name: "mfa-challenge",
  windowMs: 5 * 60_000,
  max: 5,
  failuresOnly: true,
  key: (req) => String(req.body?.mfaToken ?? "").slice(-64),
});

// Codes sent per email address: enough for a few retries, too few to spam an inbox.
const emailCodeLimiter = createRateLimiter({
  name: "email-code",
  windowMs: 60 * 60_000,
  max: 6,
  key: (req) =>
    String(req.body?.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 254),
});

// Customers sign up and sign in with a code sent by email (no password).
router.post("/email-code", authRateLimiter, emailCodeLimiter, requestEmailCodeHandler);
router.post("/email-code/verify", authRateLimiter, verifyEmailCodeHandler);

router.post("/register", authRateLimiter, registerHandler);
router.post("/login", authRateLimiter, loginAccountLimiter, loginHandler);
router.post("/login/mfa", authRateLimiter, mfaChallengeLimiter, mfaLoginHandler);
router.post("/refresh", refreshRateLimiter, refreshHandler);
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
