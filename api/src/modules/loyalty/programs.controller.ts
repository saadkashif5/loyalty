import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { createProgramSchema, updateProgramSchema } from "@taptapsell/validation";
import * as service from "./programs.service";

export const createProgramHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createProgramSchema.parse(req.body);
  const program = await service.createProgram(req.businessId!, req.userId!, input);
  sendSuccess(res, program, { status: 201 });
});

export const listProgramsHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listPrograms(req.businessId!));
});

export const getProgramHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getProgram(req.businessId!, req.params.programId));
});

export const updateProgramHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProgramSchema.parse(req.body);
  const program = await service.updateProgram(
    req.businessId!,
    req.params.programId,
    req.userId!,
    input,
  );
  sendSuccess(res, program);
});
