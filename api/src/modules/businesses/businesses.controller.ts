import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { updateBusinessSchema } from "@taptapsell/validation";
import * as service from "./businesses.service";

export const listMyBusinessesHandler = asyncHandler(async (req: Request, res: Response) => {
  const businesses = await service.listMyBusinesses(req.userId!);
  sendSuccess(res, businesses);
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
