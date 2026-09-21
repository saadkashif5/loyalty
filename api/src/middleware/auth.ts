import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/modules/auth/token.service";
import { User } from "@/models";
import { ApiError } from "@/utils/ApiError";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    platformRole?: string | null;
  }
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
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    const user = await User.findById(payload.sub).select("status platformRole");

    if (!user || user.status !== "ACTIVE") {
      next(ApiError.unauthorized("Account is not active"));
      return;
    }

    req.userId = payload.sub;
    req.platformRole = user.platformRole;
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired access token"));
  }
}
