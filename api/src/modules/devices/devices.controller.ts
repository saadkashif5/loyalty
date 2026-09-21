import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  activateDeviceSchema,
  assignDeviceSchema,
  registerDeviceSchema,
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
  sendSuccess(res, await service.listDevices(req.businessId!));
});

export const activateDeviceHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = activateDeviceSchema.parse(req.body);
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
  sendSuccess(
    res,
    await service.replaceDevice(req.businessId!, req.params.deviceId, req.userId!),
    { status: 201 },
  );
});
