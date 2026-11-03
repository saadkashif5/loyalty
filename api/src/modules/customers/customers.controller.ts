import { cursorParams } from "@/utils/cursor";
import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import * as service from "./customers.service";

export const listCustomersHandler = asyncHandler(async (req: Request, res: Response) => {
  const paging = cursorParams(req.query);
  const query = typeof req.query.q === "string" ? req.query.q.slice(0, 60) : undefined;

  const { items, nextCursor } = await service.listBusinessCustomers(req.businessId!, {
    query,
    ...paging,
  });
  sendSuccess(res, items, { meta: { limit: paging.limit, nextCursor } });
});

export const getCustomerHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getBusinessCustomer(req.businessId!, req.params.customerId));
});
