import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
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
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;

  const { items, total } = await service.listBusinessStamps(req.businessId!, {
    page,
    limit,
    branchId,
  });

  sendSuccess(res, items, { meta: { page, limit, total } });
});
