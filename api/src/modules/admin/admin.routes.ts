import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { requirePlatformPermission } from "@/middleware/requirePlatformPermission";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import {
  addTeamMemberSchema,
  createBusinessWithOwnerSchema,
  updateLeadSchema,
  updateTeamMemberSchema,
} from "@taptapsell/validation";
import * as service from "./admin.service";
import * as invitations from "@/modules/invitations/invitations.service";
import * as leads from "@/modules/leads/leads.service";
import * as fraud from "@/modules/fraud/fraud.service";
import { registerDevicesHandler, assignDeviceHandler } from "@/modules/devices/devices.controller";

// Mounted at /api/v1/admin. Every route names the platform permission it needs;
// requirePlatformPermission also insists on two-step verification.
const router = Router();
const P = PLATFORM_PERMISSIONS;
const can = requirePlatformPermission;

router.use(requireAuth);

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
  can(P.ANALYTICS_VIEW),
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await service.getPlatformOverview());
  }),
);

// ---- Businesses and owner invitations --------------------------------------

router.get(
  "/businesses",
  can(P.BUSINESS_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const query = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : undefined;
    const { items, total } = await service.listBusinesses({ status, query, page, limit });
    sendSuccess(res, items, { meta: { page, limit, total } });
  }),
);

// Businesses join by invitation only: this creates the business and invites its owner.
router.post(
  "/businesses",
  can(P.BUSINESS_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createBusinessWithOwnerSchema.parse(req.body);
    sendSuccess(res, await invitations.createBusinessWithInvitation(req.userId!, input), {
      status: 201,
    });
  }),
);

router.get(
  "/businesses/:businessId",
  can(P.BUSINESS_VIEW),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.getBusinessDetail(req.params.businessId));
  }),
);

router.patch(
  "/businesses/:businessId/status",
  can(P.BUSINESS_MANAGE),
  asyncHandler(async (req, res) => {
    const { status, reason } = statusSchema.parse(req.body);
    sendSuccess(
      res,
      await service.setBusinessStatus(req.params.businessId, req.userId!, status, reason),
    );
  }),
);

router.get(
  "/businesses/:businessId/invitations",
  can(P.BUSINESS_VIEW),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await invitations.listInvitations(req.params.businessId));
  }),
);

router.post(
  "/invitations/:invitationId/resend",
  can(P.BUSINESS_MANAGE),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await invitations.resendInvitation(req.userId!, req.params.invitationId));
  }),
);

router.post(
  "/invitations/:invitationId/revoke",
  can(P.BUSINESS_MANAGE),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await invitations.revokeInvitation(req.userId!, req.params.invitationId));
  }),
);

// ---- Leads ------------------------------------------------------------------

router.get(
  "/leads",
  can(P.BUSINESS_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const { items, total } = await leads.listLeads({ status, page, limit });
    sendSuccess(res, items, { meta: { page, limit, total } });
  }),
);

router.patch(
  "/leads/:leadId",
  can(P.BUSINESS_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateLeadSchema.parse(req.body);
    sendSuccess(res, await leads.updateLead(req.userId!, req.params.leadId, input));
  }),
);

// ---- Alerts across all businesses ---------------------------------------------

router.get(
  "/fraud-flags",
  can(P.BUSINESS_VIEW),
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "OPEN";
    sendSuccess(res, await fraud.listFlags({ status, limit: 200 }));
  }),
);

// ---- Users --------------------------------------------------------------------

router.get(
  "/customers",
  can(P.USER_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const { items, total } = await service.listCustomers({ query, page, limit });
    sendSuccess(res, items, { meta: { page, limit, total } });
  }),
);

router.patch(
  "/customers/:userId/status",
  can(P.USER_MANAGE),
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    sendSuccess(res, await service.setUserStatus(req.params.userId, req.userId!, status));
  }),
);

router.post(
  "/users/:userId/sign-out",
  can(P.USER_MANAGE),
  asyncHandler(async (req, res) => {
    await service.signOutUser(req.userId!, req.params.userId);
    sendSuccess(res, { signedOut: true });
  }),
);

// ---- Stamper fleet ------------------------------------------------------------

router.get(
  "/devices",
  can(P.BUSINESS_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    const { items, total } = await service.listDevices({
      status: str(req.query.status),
      businessId: str(req.query.businessId),
      query: str(req.query.q)?.slice(0, 32),
      page,
      limit,
    });
    sendSuccess(res, items, { meta: { page, limit, total } });
  }),
);
router.post("/devices", can(P.DEVICE_MANAGE), registerDevicesHandler);
router.patch("/devices/:deviceId/assign", can(P.DEVICE_MANAGE), assignDeviceHandler);

// ---- Audit log ----------------------------------------------------------------

router.get(
  "/audit-logs",
  can(P.AUDIT_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
    const { items, total } = await service.listAuditLogs({ businessId, page, limit });
    sendSuccess(res, items, { meta: { page, limit, total } });
  }),
);

// ---- Platform team ------------------------------------------------------------

router.get(
  "/team",
  can(P.TEAM_MANAGE),
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await service.listTeam());
  }),
);

router.post(
  "/team",
  can(P.TEAM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = addTeamMemberSchema.parse(req.body);
    sendSuccess(res, await service.addTeamMember(req.userId!, input), { status: 201 });
  }),
);

router.patch(
  "/team/:userId",
  can(P.TEAM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateTeamMemberSchema.parse(req.body);
    sendSuccess(res, await service.updateTeamMember(req.userId!, req.params.userId, input));
  }),
);

export default router;
