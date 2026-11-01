import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { Business, BusinessMember } from "@/models";
import { runAsTenant } from "@/models/tenantGuard";
import { ApiError } from "@/utils/ApiError";
import { mfaSetupRequired } from "@/middleware/auth";
import { REDEEM_DURING_BILLING_SUSPENSION_DAYS } from "@/modules/billing/billing.config";
import {
  BUSINESS_ROLE_HIERARCHY,
  BUSINESS_ROLES,
  BUSINESS_STATUS,
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
    /** Branches this member may act at; empty means every branch. */
    branchScope?: string[];
  }
}

interface Options {
  /** Minimum role in the hierarchy (OWNER > MANAGER > STAFF). */
  minRole?: BusinessRole;
  /** Permission required (or any one of several), checked against role defaults + member overrides. */
  permission?: BusinessPermission | BusinessPermission[];
  /** Route param holding the business id. Defaults to "businessId". */
  paramName?: string;
  /**
   * Keeps this action available while the business is suspended for
   * non-payment: "redeem" for 30 days (customers use rewards they earned),
   * "pay" for as long as it lasts (the owner must be able to pay).
   */
  billingSuspension?: "redeem" | "pay";
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Full server-side authorization chain per PRD §29:
// authenticated user -> business membership -> role -> permission -> resource scope.
// Every business-scoped route must apply this after requireAuth.
export function requireBusinessRole(options: Options = {}) {
  const paramName = options.paramName ?? "businessId";
  const required = options.permission
    ? Array.isArray(options.permission)
      ? options.permission
      : [options.permission]
    : [];

  // Express 4 ignores a rejected promise from middleware, so failures must reach next().
  return (req: Request, res: Response, next: NextFunction): void => {
    authorize(req, res, next).catch(next);
  };

  async function authorize(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!req.userId) {
      next(ApiError.unauthorized());
      return;
    }

    const businessId = req.params[paramName] ?? req.body?.businessId;
    if (!businessId) {
      next(ApiError.badRequest(`Missing ${paramName}`));
      return;
    }

    // Same answer as a business they are not in. Also keeps bad ids away from the queries below.
    if (!isValidObjectId(businessId)) {
      next(ApiError.forbidden("You do not have access to this business"));
      return;
    }

    const [member, business] = await Promise.all([
      BusinessMember.findOne({ userId: req.userId, businessId }),
      Business.findById(businessId).select("status suspension"),
    ]);

    if (!member || member.status !== MEMBER_STATUS.ACTIVE || !business) {
      // Same error for "not a member" and "disabled member" — avoids leaking membership existence.
      next(ApiError.forbidden("You do not have access to this business"));
      return;
    }

    // Owners control the whole tenant, so they must use two-step verification.
    if (member.role === BUSINESS_ROLES.OWNER && !req.mfaEnabled) {
      next(mfaSetupRequired());
      return;
    }

    // A suspended business keeps read access to its data but can change nothing (§60).
    const unpaid = business.suspension?.kind === "BILLING";
    const billingGrace =
      unpaid &&
      (options.billingSuspension === "pay" ||
        (options.billingSuspension === "redeem" &&
          business.suspension?.at &&
          Date.now() - business.suspension.at.getTime() <
            REDEEM_DURING_BILLING_SUSPENSION_DAYS * 86_400_000));

    if (
      business.status === BUSINESS_STATUS.SUSPENDED &&
      !READ_METHODS.has(req.method) &&
      !billingGrace
    ) {
      const reason = business.suspension?.reason;
      next(
        new ApiError(
          403,
          "BUSINESS_SUSPENDED",
          `This business is suspended${reason ? `: ${reason}` : ""}. Contact TapTapSell to restore it.`,
        ),
      );
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

    if (required.length > 0 && !required.some((p) => effectivePermissions.has(p))) {
      next(ApiError.forbidden());
      return;
    }

    req.businessId = businessId;
    req.businessRole = member.role as BusinessRole;
    req.businessPermissions = Array.from(effectivePermissions);
    // Owners always see every branch; others are limited to their assigned branches, if any.
    req.branchScope =
      member.role === BUSINESS_ROLES.OWNER ? [] : member.branchIds.map((id) => id.toString());
    // Everything after this point can only touch this business's data.
    runAsTenant(String(businessId), next);
  }
}

/** Rejects acting at a branch outside the member's assigned branches. */
export function assertBranchInScope(req: Request, branchId: string | undefined): void {
  const scope = req.branchScope ?? [];
  if (scope.length === 0) return;
  if (!branchId) {
    throw ApiError.badRequest("Choose the branch you are working at");
  }
  if (!scope.includes(branchId)) {
    throw ApiError.forbidden("You can only do this at the branches you are assigned to");
  }
}
