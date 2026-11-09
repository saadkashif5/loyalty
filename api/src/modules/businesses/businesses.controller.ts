import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { updateBusinessSchema } from "@taptapsell/validation";
import * as service from "./businesses.service";
import { listActiveGrants } from "@/modules/support/support.service";

export const listMyBusinessesHandler = asyncHandler(async (req: Request, res: Response) => {
  const businesses = await service.listMyBusinesses(req.userId!);
  // Platform team members also see the businesses they have a support view open on.
  const support = req.platformRole
    ? (await listActiveGrants(req.userId!))
        .filter((g) => g.businessId)
        .map((g) => ({
          business: g.businessId,
          role: "OWNER" as const,
          branchIds: [],
          supportView: { expiresAt: g.expiresAt, reason: g.reason },
        }))
    : [];
  const memberOf = new Set(businesses.map((b) => String(b.business?._id)));
  sendSuccess(res, [
    ...businesses,
    ...support.filter((s) => !memberOf.has(String(s.business._id))),
  ]);
});

export const getBusinessHandler = asyncHandler(async (req: Request, res: Response) => {
  const business = await service.getBusinessById(req.businessId!);
  sendSuccess(res, business);
});

export const updateBusinessHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateBusinessSchema.parse(req.body);
  const business = await service.updateBusiness(req.businessId!, req.userId!, input);
  sendSuccess(res, business);
});

export const myInvitationsHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listMyPendingInvitations(req.userId!));
});

export const onboardingHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getOnboardingStatus(req.businessId!));
});
