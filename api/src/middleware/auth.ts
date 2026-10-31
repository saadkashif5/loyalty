import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/modules/auth/token.service";
import { User } from "@/models";
import { ApiError } from "@/utils/ApiError";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    sessionId?: string;
    platformRole?: string | null;
    mfaEnabled?: boolean;
  }
}

async function authenticate(req: Request, header: string): Promise<void> {
  const payload = verifyAccessToken(header.slice("Bearer ".length));
  const user = await User.findById(payload.sub).select("status platformRole mfa.enabled");

  if (!user || user.status !== "ACTIVE") {
    throw ApiError.unauthorized("Account is not active");
  }

  req.userId = payload.sub;
  req.sessionId = payload.sid;
  req.platformRole = user.platformRole;
  req.mfaEnabled = Boolean(user.mfa?.enabled);
}

// Authenticates the request (§29 step 1). Authorization (role/permission/scope)
// happens in separate middleware layered on top — see requireBusinessRole.ts.
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    next(ApiError.unauthorized());
    return;
  }

  try {
    await authenticate(req, header);
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : ApiError.unauthorized("Invalid or expired access token"));
  }
}

/** Like requireAuth, but lets anonymous requests through. A bad token is still rejected. */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.header("authorization")) {
    next();
    return;
  }
  await requireAuth(req, res, next);
}

export function mfaSetupRequired() {
  return new ApiError(
    403,
    "MFA_SETUP_REQUIRED",
    "Set up two-step verification on your account to continue.",
  );
}
