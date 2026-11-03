import { cursorParams } from "@/utils/cursor";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { requirePlatformPermission } from "@/middleware/requirePlatformPermission";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import {
  addChargeSchema,
  addTeamMemberSchema,
  billingSettingsSchema,
  changeSubscriptionPlanSchema,
  issueInvoiceSchema,
  rejectProofSchema,
  setDiscountSchema,
  voidInvoiceSchema,
  createBusinessWithOwnerSchema,
  createPlanSchema,
  extendTrialSchema,
  recordPaymentSchema,
  updatePlanSchema,
  updateLeadSchema,
  updateTeamMemberSchema,
} from "@taptapsell/validation";
import * as service from "./admin.service";
import * as invitations from "@/modules/invitations/invitations.service";
import * as leads from "@/modules/leads/leads.service";
import * as fraud from "@/modules/fraud/fraud.service";
import * as plans from "@/modules/billing/plans.service";
import * as billing from "@/modules/billing/subscriptions.service";
import * as invoices from "@/modules/billing/invoices.service";
import * as planChange from "@/modules/billing/planChange.service";
import * as proofs from "@/modules/billing/proofs.service";
import { renderInvoicePdf } from "@/modules/billing/invoicePdf.service";
import { invoicesCsv } from "@/modules/billing/export.service";
import { getBillingSettings, updateBillingSettings } from "@/modules/billing/settings.service";
import { registerDevicesHandler, assignDeviceHandler } from "@/modules/devices/devices.controller";

// Mounted at /api/v1/admin. Every route names the platform permission it needs;
// requirePlatformPermission also insists on two-step verification.
const router = Router();
const P = PLATFORM_PERMISSIONS;
const can = requirePlatformPermission;

router.use(requireAuth);

// Page numbers for lists that grow with the number of businesses (businesses,
// stampers, leads), where counts are cheap and the overview needs them. Lists
// that grow with customers and activity use cursors (utils/cursor.ts).
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

// ---- Billing ------------------------------------------------------------------

router.get(
  "/plans",
  can(P.BILLING_VIEW),
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await plans.listPlans());
  }),
);

router.post(
  "/plans",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createPlanSchema.parse(req.body);
    sendSuccess(res, await plans.createPlan(req.userId!, input), { status: 201 });
  }),
);

router.patch(
  "/plans/:planId",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updatePlanSchema.parse(req.body);
    sendSuccess(res, await plans.updatePlan(req.userId!, req.params.planId, input));
  }),
);

router.get(
  "/billing/overview",
  can(P.BILLING_VIEW),
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await billing.getFinanceOverview());
  }),
);

router.get(
  "/businesses/:businessId/billing",
  can(P.BILLING_VIEW),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await billing.getBillingSummary(req.params.businessId));
  }),
);

router.patch(
  "/businesses/:businessId/subscription",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = changeSubscriptionPlanSchema.parse(req.body);
    sendSuccess(res, await billing.changePlan(req.userId!, req.params.businessId, input));
  }),
);

// Extras for the next invoice: stampers, replacements.
router.post(
  "/businesses/:businessId/charges",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = addChargeSchema.parse(req.body);
    sendSuccess(res, await planChange.addCharge(req.userId!, req.params.businessId, input), {
      status: 201,
    });
  }),
);

router.delete(
  "/businesses/:businessId/charges/:chargeId",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const { businessId, chargeId } = req.params;
    sendSuccess(res, await planChange.removeCharge(req.userId!, businessId, chargeId));
  }),
);

router.post(
  "/businesses/:businessId/subscription/extend-trial",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = extendTrialSchema.parse(req.body);
    sendSuccess(res, await billing.extendTrial(req.userId!, req.params.businessId, input));
  }),
);

router.post(
  "/businesses/:businessId/payments",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = recordPaymentSchema.parse(req.body);
    sendSuccess(res, await billing.recordPayment(req.userId!, req.params.businessId, input), {
      status: 201,
    });
  }),
);

router.get(
  "/settings/billing",
  can(P.BILLING_VIEW),
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getBillingSettings());
  }),
);

router.put(
  "/settings/billing",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = billingSettingsSchema.parse(req.body);
    sendSuccess(res, await updateBillingSettings(req.userId!, input));
  }),
);

router.patch(
  "/businesses/:businessId/subscription/discount",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const { discountPercent } = setDiscountSchema.parse(req.body);
    sendSuccess(
      res,
      await billing.setDiscount(req.userId!, req.params.businessId, discountPercent),
    );
  }),
);

router.post(
  "/businesses/:businessId/invoices",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const { periods } = issueInvoiceSchema.parse(req.body ?? {});
    sendSuccess(res, await billing.issueInvoiceFor(req.userId!, req.params.businessId, periods), {
      status: 201,
    });
  }),
);

router.get(
  "/invoices/:invoiceId/pdf",
  can(P.BILLING_VIEW),
  asyncHandler(async (req, res) => {
    const invoice = await invoices.getInvoice(req.params.invoiceId);
    const pdf = await renderInvoicePdf(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoice.number}.pdf"`);
    res.send(pdf);
  }),
);

router.post(
  "/invoices/:invoiceId/void",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const { reason } = voidInvoiceSchema.parse(req.body);
    sendSuccess(res, await invoices.voidInvoice(req.userId!, req.params.invoiceId, reason));
  }),
);

router.get(
  "/payment-proofs",
  can(P.BILLING_VIEW),
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "PENDING";
    sendSuccess(res, await proofs.listProofs(status));
  }),
);

router.get(
  "/payment-proofs/:proofId/file",
  can(P.BILLING_VIEW),
  asyncHandler(async (req, res) => {
    const { stream, mimeType } = await proofs.openProofFile(req.params.proofId);
    res.setHeader("Content-Type", mimeType);
    // Shown in the browser, never run: no sniffing, and a sandbox for PDFs.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox");
    stream.on("error", () => res.status(404).end());
    stream.pipe(res);
  }),
);

router.post(
  "/payment-proofs/:proofId/approve",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await proofs.approveProof(req.userId!, req.params.proofId));
  }),
);

router.post(
  "/payment-proofs/:proofId/reject",
  can(P.BILLING_MANAGE),
  asyncHandler(async (req, res) => {
    const { reason } = rejectProofSchema.parse(req.body);
    sendSuccess(res, await proofs.rejectProof(req.userId!, req.params.proofId, reason));
  }),
);

router.get(
  "/billing/export.csv",
  can(P.BILLING_VIEW),
  asyncHandler(async (req, res) => {
    const parse = (v: unknown, fallback: Date) => {
      const d = typeof v === "string" ? new Date(v) : fallback;
      return Number.isNaN(d.getTime()) ? fallback : d;
    };
    const now = new Date();
    const from = parse(
      req.query.from,
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    );
    const to = parse(req.query.to, now);
    const csv = await invoicesCsv(from, new Date(to.getTime() + 86_400_000));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="invoices.csv"');
    // Byte-order mark so Excel opens the file as UTF-8.
    res.send(`\uFEFF${csv}`);
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
    const paging = cursorParams(req.query);
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const { items, nextCursor } = await service.listCustomers({ query, ...paging });
    sendSuccess(res, items, { meta: { limit: paging.limit, nextCursor } });
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
    const paging = cursorParams(req.query);
    const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
    const { items, nextCursor } = await service.listAuditLogs({ businessId, ...paging });
    sendSuccess(res, items, { meta: { limit: paging.limit, nextCursor } });
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
