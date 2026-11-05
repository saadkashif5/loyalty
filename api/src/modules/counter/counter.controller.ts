import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { assertBranchInScope } from "@/middleware/requireBusinessRole";
import { counterCodeSchema, counterStampSchema } from "@taptapsell/validation";
import { createCounterStamp } from "@/modules/stamps/stamps.service";
import * as service from "./counter.service";

// Customer: the code their card shows at the counter.
export const issueCounterCodeHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.issueCounterCode(req.userId!, req.params.cardId));
});

// Staff: confirm who the code belongs to before stamping.
export const lookupCounterCodeHandler = asyncHandler(async (req: Request, res: Response) => {
  const { code } = counterCodeSchema.parse(req.body);
  sendSuccess(res, await service.lookupCounterCode(req.businessId!, code));
});

export const counterStampHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = counterStampSchema.parse(req.body);
  assertBranchInScope(req, input.branchId);

  const result = await createCounterStamp({
    businessId: req.businessId!,
    actorUserId: req.userId!,
    code: input.code,
    branchId: input.branchId,
    idempotencyKey: req.idempotencyKey!,
    actorRole: req.businessRole,
  });
  // 202: waiting for a manager to approve.
  const status = "pendingApproval" in result ? 202 : result.alreadyRecorded ? 200 : 201;
  sendSuccess(res, result, { status });
});
