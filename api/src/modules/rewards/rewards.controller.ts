import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { createRewardSchema, updateRewardSchema } from "@taptapsell/validation";
import * as service from "./rewards.service";

export const createRewardHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createRewardSchema.parse(req.body);
  const reward = await service.createReward(req.businessId!, req.userId!, input);
  sendSuccess(res, reward, { status: 201 });
});

export const listRewardsHandler = asyncHandler(async (req: Request, res: Response) => {
  const programId = typeof req.query.programId === "string" ? req.query.programId : undefined;
  sendSuccess(res, await service.listRewards(req.businessId!, programId));
});

export const updateRewardHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateRewardSchema.parse(req.body);
  const reward = await service.updateReward(
    req.businessId!,
    req.params.rewardId,
    req.userId!,
    input,
  );
  sendSuccess(res, reward);
});
