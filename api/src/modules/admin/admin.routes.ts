import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { requirePlatformRole } from "@/middleware/requirePlatformRole";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { PLATFORM_ROLES } from "@taptapsell/constants";
import * as service from "./admin.service";
import { registerDevicesHandler, assignDeviceHandler } from "@/modules/devices/devices.controller";

const router = Router();

router.use(requireAuth, requirePlatformRole(PLATFORM_ROLES.ADMIN));

function pagination(query: Record<string, unknown>) {
  return {
    page: Math.max(1, Number(query.page) || 1),
    limit: Math.min(100, Math.max(1, Number(query.limit) || 25)),
  };
}

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().max(500).optional(),
});

router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await service.getPlatformOverview());
  }),
);

router.get(
  "/businesses",
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const { items, total } = await service.listBusinesses({ status, page, limit });
    sendSuccess(res, items, { meta: { page, limit, total } });
  }),
);

router.patch(
  "/businesses/:businessId/status",
  asyncHandler(async (req, res) => {
    const { status, reason } = statusSchema.parse(req.body);
    sendSuccess(
      res,
      await service.setBusinessStatus(req.params.businessId, req.userId!, status, reason),
    );
  }),
);

router.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const { items, total } = await service.listCustomers({ query, page, limit });
    sendSuccess(res, items, { meta: { page, limit, total } });
  }),
);

router.patch(
  "/customers/:userId/status",
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    sendSuccess(res, await service.setUserStatus(req.params.userId, req.userId!, status));
  }),
);

// Device fleet management: minting and assignment are platform operations.
router.post("/devices", registerDevicesHandler);
router.patch("/devices/:deviceId/assign", assignDeviceHandler);

router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
    const { items, total } = await service.listAuditLogs({ businessId, page, limit });
    sendSuccess(res, items, { meta: { page, limit, total } });
  }),
);

export default router;
