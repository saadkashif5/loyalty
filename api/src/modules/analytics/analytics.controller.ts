import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import * as service from "./analytics.service";

export const overviewHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getBusinessOverview(req.businessId!));
});

export const stampsOverTimeHandler = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  sendSuccess(res, await service.getStampsOverTime(req.businessId!, { days, branchId }));
});

export const nearCompletionHandler = asyncHandler(async (req: Request, res: Response) => {
  const within = Math.min(5, Math.max(1, Number(req.query.within) || 2));
  sendSuccess(res, await service.getCustomersNearCompletion(req.businessId!, within));
});
