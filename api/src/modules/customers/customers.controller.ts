import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import * as service from "./customers.service";

export const listCustomersHandler = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const query = typeof req.query.q === "string" ? req.query.q.slice(0, 60) : undefined;

  const { items, total } = await service.listBusinessCustomers(req.businessId!, {
    query,
    page,
    limit,
  });
  sendSuccess(res, items, { meta: { page, limit, total } });
});

export const getCustomerHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getBusinessCustomer(req.businessId!, req.params.customerId));
});
