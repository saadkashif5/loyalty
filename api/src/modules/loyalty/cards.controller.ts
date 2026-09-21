import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { joinProgramSchema } from "@taptapsell/validation";
import * as service from "./cards.service";

export const joinProgramHandler = asyncHandler(async (req: Request, res: Response) => {
  const { programId } = joinProgramSchema.parse(req.body);
  const card = await service.joinProgram(req.userId!, programId);
  sendSuccess(res, card, { status: 201 });
});

export const listMyCardsHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listCustomerCards(req.userId!));
});

export const getMyCardHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getCardDetail(req.userId!, req.params.cardId));
});
