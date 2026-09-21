import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/ApiError";
import { PLATFORM_ROLES, type PlatformRole } from "@taptapsell/constants";

const RANK: Record<PlatformRole, number> = {
  [PLATFORM_ROLES.ADMIN]: 1,
  [PLATFORM_ROLES.SUPER_ADMIN]: 2,
};

// Gates /api/v1/admin routes. ADMIN must not reach SUPER_ADMIN-only actions (§5.1).
export function requirePlatformRole(minRole: PlatformRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.platformRole as PlatformRole | null | undefined;
    if (!role || RANK[role] < RANK[minRole]) {
      next(ApiError.forbidden());
      return;
    }
    next();
  };
}
