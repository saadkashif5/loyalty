import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { assertBranchInScope } from "@/middleware/requireBusinessRole";
import {
  activateDeviceSchema,
  assignDeviceSchema,
  registerDeviceSchema,
  reportDeviceProblemSchema,
  revokeDeviceSchema,
} from "@taptapsell/validation";
import * as service from "./devices.service";

// Platform admin
export const registerDevicesHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = registerDeviceSchema.parse(req.body);
  sendSuccess(res, await service.registerDevices(req.userId!, input), { status: 201 });
});

export const assignDeviceHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = assignDeviceSchema.parse(req.body);
  sendSuccess(res, await service.assignDevice(req.params.deviceId, req.userId!, input));
});

// Business-scoped
export const listDevicesHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listDevices(req.businessId!, req.branchScope));
});

export const activateDeviceHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = activateDeviceSchema.parse(req.body);
  assertBranchInScope(req, input.branchId);
  sendSuccess(res, await service.activateDevice(req.businessId!, req.userId!, input));
});

export const revokeDeviceHandler = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = revokeDeviceSchema.parse(req.body ?? {});
  sendSuccess(
    res,
    await service.revokeDevice(req.businessId!, req.params.deviceId, req.userId!, reason),
  );
});

export const replaceDeviceHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.replaceDevice(req.businessId!, req.params.deviceId, req.userId!), {
    status: 201,
  });
});

export const reportDeviceProblemHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = reportDeviceProblemSchema.parse(req.body);
  sendSuccess(
    res,
    await service.reportDeviceProblem(
      req.businessId!,
      req.params.deviceId,
      req.userId!,
      input,
      req.branchScope,
    ),
  );
});
