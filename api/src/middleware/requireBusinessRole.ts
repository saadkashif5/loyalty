import type { NextFunction, Request, Response } from "express";
import { BusinessMember } from "@/models";
import { ApiError } from "@/utils/ApiError";
import {
  BUSINESS_ROLE_HIERARCHY,
  DEFAULT_ROLE_PERMISSIONS,
  MEMBER_STATUS,
  type BusinessPermission,
  type BusinessRole,
} from "@taptapsell/constants";

declare module "express-serve-static-core" {
  interface Request {
    businessId?: string;
    businessRole?: BusinessRole;
    businessPermissions?: BusinessPermission[];
  }
}

interface Options {
  /** Minimum role in the hierarchy (OWNER > MANAGER > STAFF). */
  minRole?: BusinessRole;
  /** Specific permission required, checked against role defaults + member overrides. */
  permission?: BusinessPermission;
  /** Route param holding the business id. Defaults to "businessId". */
  paramName?: string;
}

// Full server-side authorization chain per PRD §29:
// authenticated user -> business membership -> role -> permission -> resource scope.
// Every business-scoped route must apply this after requireAuth.
export function requireBusinessRole(options: Options = {}) {
  const paramName = options.paramName ?? "businessId";

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      next(ApiError.unauthorized());
      return;
    }

    const businessId = req.params[paramName] ?? req.body?.businessId;
    if (!businessId) {
      next(ApiError.badRequest(`Missing ${paramName}`));
      return;
    }

    const member = await BusinessMember.findOne({ userId: req.userId, businessId });

    if (!member || member.status !== MEMBER_STATUS.ACTIVE) {
      // Same error for "not a member" and "disabled member" — avoids leaking membership existence.
      next(ApiError.forbidden("You do not have access to this business"));
      return;
    }

    if (options.minRole) {
      const has = BUSINESS_ROLE_HIERARCHY[member.role as BusinessRole];
      const needs = BUSINESS_ROLE_HIERARCHY[options.minRole];
      if (has < needs) {
        next(ApiError.forbidden());
        return;
      }
    }

    const effectivePermissions = new Set([
      ...DEFAULT_ROLE_PERMISSIONS[member.role as BusinessRole],
      ...(member.permissions as BusinessPermission[]),
    ]);

    if (options.permission && !effectivePermissions.has(options.permission)) {
      next(ApiError.forbidden());
      return;
    }

    req.businessId = businessId;
    req.businessRole = member.role as BusinessRole;
    req.businessPermissions = Array.from(effectivePermissions);
    next();
  };
}
