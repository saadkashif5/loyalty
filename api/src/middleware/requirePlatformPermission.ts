import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";
import { mfaSetupRequired } from "@/middleware/auth";
import {
  DEFAULT_PLATFORM_ROLE_PERMISSIONS,
  type PlatformPermission,
  type PlatformRole,
} from "@taptapsell/constants";

// Gates /api/v1/admin routes. Must run after requireAuth. Every platform user
// needs two-step verification before any admin action (ROADMAP Phase 1).
export function requirePlatformPermission(permission: PlatformPermission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.platformRole as PlatformRole | null | undefined;
    if (!role) {
      next(ApiError.forbidden());
      return;
    }
    if (!req.mfaEnabled && !env.SKIP_MFA) {
      next(mfaSetupRequired());
      return;
    }
    if (!DEFAULT_PLATFORM_ROLE_PERMISSIONS[role]?.includes(permission)) {
      next(ApiError.forbidden());
      return;
    }
    next();
  };
}
