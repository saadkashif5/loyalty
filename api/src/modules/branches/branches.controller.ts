import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { createBranchSchema, updateBranchSchema } from "@taptapsell/validation";
import * as service from "./branches.service";

export const createBranchHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createBranchSchema.parse(req.body);
  const branch = await service.createBranch(req.businessId!, req.userId!, input);
  sendSuccess(res, branch, { status: 201 });
});

export const listBranchesHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listBranches(req.businessId!));
});

export const getBranchHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getBranch(req.businessId!, req.params.branchId));
});

export const updateBranchHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateBranchSchema.parse(req.body);
  const branch = await service.updateBranch(
    req.businessId!,
    req.params.branchId,
    req.userId!,
    input,
  );
  sendSuccess(res, branch);
});
