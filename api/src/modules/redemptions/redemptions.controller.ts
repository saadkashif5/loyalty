import { cursorParams } from "@/utils/cursor";
import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { assertBranchInScope } from "@/middleware/requireBusinessRole";
import { createRedemptionSchema, validateRedemptionSchema } from "@taptapsell/validation";
import * as service from "./redemptions.service";

export const listMyRedemptionsHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listCustomerRedemptions(req.userId!));
});

export const getMyRedemptionHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getRedemption(req.userId!, req.params.redemptionId));
});

export const requestRedemptionHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createRedemptionSchema.parse(req.body);
  const redemption = await service.requestRedemption(req.userId!, input);
  sendSuccess(res, redemption, { status: 201 });
});

export const validateRedemptionHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = validateRedemptionSchema.parse(req.body);
  assertBranchInScope(req, input.branchId);
  const redemption = await service.validateRedemption({
    businessId: req.businessId!,
    staffUserId: req.userId!,
    redemptionCode: input.redemptionCode,
    branchId: input.branchId,
  });
  sendSuccess(res, redemption);
});

export const listBusinessRedemptionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const paging = cursorParams(req.query);
  const { items, nextCursor } = await service.listBusinessRedemptions(req.businessId!, {
    ...paging,
    branchIds: req.branchScope,
  });
  sendSuccess(res, items, { meta: { limit: paging.limit, nextCursor } });
});
