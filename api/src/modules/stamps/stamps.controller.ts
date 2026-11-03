import { cursorParams } from "@/utils/cursor";
import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { assertBranchInScope } from "@/middleware/requireBusinessRole";
import { createManualStampSchema, createStampSchema } from "@taptapsell/validation";
import * as service from "./stamps.service";

export const createStampHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createStampSchema.parse(req.body);

  const base = {
    customerId: req.userId!,
    idempotencyKey: req.idempotencyKey!,
    metadata: input.metadata,
  };

  const result = await service.createStamp(
    "tapToken" in input
      ? { ...base, tapToken: input.tapToken }
      : { ...base, deviceIdentifier: input.deviceIdentifier, source: input.source },
  );

  sendSuccess(res, result, { status: result.alreadyRecorded ? 200 : 201 });
});

export const createManualStampHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createManualStampSchema.parse(req.body);
  assertBranchInScope(req, input.branchId);

  const result = await service.createManualStamp({
    businessId: req.businessId!,
    actorUserId: req.userId!,
    loyaltyCardId: input.loyaltyCardId,
    branchId: input.branchId,
    idempotencyKey: req.idempotencyKey!,
  });

  sendSuccess(res, result, { status: result.alreadyRecorded ? 200 : 201 });
});

export const listMyStampsHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listCustomerStamps(req.userId!));
});

export const listBusinessStampsHandler = asyncHandler(async (req: Request, res: Response) => {
  const paging = cursorParams(req.query);
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  if (branchId) assertBranchInScope(req, branchId);

  const { items, nextCursor } = await service.listBusinessStamps(req.businessId!, {
    ...paging,
    branchIds: branchId ? [branchId] : req.branchScope,
  });

  sendSuccess(res, items, { meta: { limit: paging.limit, nextCursor } });
});
