import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { requireBusinessRole } from "@/middleware/requireBusinessRole";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";

import branchRoutes from "@/modules/branches/branches.routes";
import memberRoutes from "@/modules/members/members.routes";
import {
  createProgramHandler,
  listProgramsHandler,
  getProgramHandler,
  updateProgramHandler,
} from "@/modules/loyalty/programs.controller";
import {
  createRewardHandler,
  listRewardsHandler,
  updateRewardHandler,
} from "@/modules/rewards/rewards.controller";
import {
  listDevicesHandler,
  activateDeviceHandler,
  revokeDeviceHandler,
  replaceDeviceHandler,
  reportDeviceProblemHandler,
} from "@/modules/devices/devices.controller";
import { getCustomerHandler, listCustomersHandler } from "@/modules/customers/customers.controller";
import { onboardingHandler } from "@/modules/businesses/businesses.controller";
import {
  counterStampHandler,
  lookupCounterCodeHandler,
} from "@/modules/counter/counter.controller";
import fraudRoutes from "@/modules/fraud/fraud.routes";
import { getBillingSummary } from "@/modules/billing/subscriptions.service";
import { getInvoice } from "@/modules/billing/invoices.service";
import { renderInvoicePdf } from "@/modules/billing/invoicePdf.service";
import { MAX_PROOF_BYTES, uploadProof } from "@/modules/billing/proofs.service";
import { singleUpload } from "@/middleware/upload";
import { createRateLimiter } from "@/middleware/rateLimit";
import { ApiError } from "@/utils/ApiError";
import { uploadProofSchema } from "@taptapsell/validation";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  createManualStampHandler,
  listBusinessStampsHandler,
} from "@/modules/stamps/stamps.controller";
import { requireIdempotencyKey } from "@/middleware/idempotency";
import {
  validateRedemptionHandler,
  listBusinessRedemptionsHandler,
} from "@/modules/redemptions/redemptions.controller";
import {
  overviewHandler,
  stampsOverTimeHandler,
  nearCompletionHandler,
} from "@/modules/analytics/analytics.controller";

// Everything here is scoped to /api/v1/businesses/:businessId and gated by
// membership + permission. No handler below may read a business id from the
// body — req.businessId is set by requireBusinessRole after verification.
const router = Router({ mergeParams: true });

router.use(requireAuth);

router.use("/branches", branchRoutes);
router.use("/members", memberRoutes);

// Loyalty programs
router.get(
  "/programs",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.PROGRAM_VIEW }),
  listProgramsHandler,
);
router.post(
  "/programs",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.PROGRAM_MANAGE }),
  createProgramHandler,
);
router.get(
  "/programs/:programId",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.PROGRAM_VIEW }),
  getProgramHandler,
);
router.patch(
  "/programs/:programId",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.PROGRAM_MANAGE }),
  updateProgramHandler,
);

// Rewards
router.get(
  "/rewards",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.REWARD_VIEW }),
  listRewardsHandler,
);
router.post(
  "/rewards",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.REWARD_MANAGE }),
  createRewardHandler,
);
router.patch(
  "/rewards/:rewardId",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.REWARD_MANAGE }),
  updateRewardHandler,
);

// NFC devices
// Staff can see their stampers so they can report a problem with one.
router.get(
  "/devices",
  requireBusinessRole({
    permission: [BUSINESS_PERMISSIONS.DEVICE_MANAGE, BUSINESS_PERMISSIONS.DEVICE_REPORT_PROBLEM],
  }),
  listDevicesHandler,
);
router.post(
  "/devices/:deviceId/report",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.DEVICE_REPORT_PROBLEM }),
  reportDeviceProblemHandler,
);
router.post(
  "/devices/activate",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.DEVICE_MANAGE }),
  activateDeviceHandler,
);
router.post(
  "/devices/:deviceId/revoke",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.DEVICE_MANAGE }),
  revokeDeviceHandler,
);
router.post(
  "/devices/:deviceId/replace",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.DEVICE_MANAGE }),
  replaceDeviceHandler,
);

// Customers: names with masked contact details, and their history here only.
router.get(
  "/customers",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.CUSTOMER_VIEW }),
  listCustomersHandler,
);
router.get(
  "/customers/:customerId",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.CUSTOMER_VIEW }),
  getCustomerHandler,
);

// Counter mode: stamp a customer who shows their card's code.
router.post(
  "/counter/lookup",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.STAMP_ISSUE_COUNTER }),
  lookupCounterCodeHandler,
);
router.post(
  "/counter/stamp",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.STAMP_ISSUE_COUNTER }),
  requireIdempotencyKey,
  counterStampHandler,
);

// The owner's plan, usage, payments and the plans they could move to.
router.get(
  "/billing",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.BUSINESS_MANAGE_BILLING }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getBillingSummary(req.businessId!));
  }),
);

router.get(
  "/invoices/:invoiceId/pdf",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.BUSINESS_MANAGE_BILLING }),
  asyncHandler(async (req, res) => {
    const invoice = await getInvoice(req.params.invoiceId, req.businessId!);
    const pdf = await renderInvoicePdf(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoice.number}.pdf"`);
    res.send(pdf);
  }),
);

// A bank or Raast receipt for an open invoice. Allowed while suspended for
// non-payment: paying is how the owner gets out of that suspension.
const proofLimiter = createRateLimiter({ name: "payment-proof", windowMs: 60 * 60_000, max: 10 });
router.post(
  "/invoices/:invoiceId/proofs",
  proofLimiter,
  requireBusinessRole({
    permission: BUSINESS_PERMISSIONS.BUSINESS_MANAGE_BILLING,
    billingSuspension: "pay",
  }),
  singleUpload("file", MAX_PROOF_BYTES),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("Attach a photo or PDF of the receipt");
    const input = uploadProofSchema.parse(req.body);
    const proof = await uploadProof({
      businessId: req.businessId!,
      invoiceId: req.params.invoiceId,
      userId: req.userId!,
      file: req.file.buffer,
      input,
    });
    sendSuccess(res, proof, { status: 201 });
  }),
);

// Alerts about suspicious stamping.
router.use("/fraud-flags", fraudRoutes);

// Setup checklist for the onboarding wizard.
router.get(
  "/onboarding",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.CUSTOMER_VIEW }),
  onboardingHandler,
);

// Loyalty activity
router.get(
  "/stamps",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.STAMP_VIEW }),
  listBusinessStampsHandler,
);
router.post(
  "/stamps/manual",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.STAMP_ISSUE_MANUAL }),
  requireIdempotencyKey,
  createManualStampHandler,
);
router.get(
  "/redemptions",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.REDEMPTION_VIEW }),
  listBusinessRedemptionsHandler,
);

// Analytics
router.get(
  "/analytics/overview",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.ANALYTICS_VIEW }),
  overviewHandler,
);
router.get(
  "/analytics/stamps",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.ANALYTICS_VIEW }),
  stampsOverTimeHandler,
);
router.get(
  "/analytics/near-completion",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.ANALYTICS_VIEW }),
  nearCompletionHandler,
);

// Staff-facing reward validation — the counter workflow (§17.1 step 6).
router.post(
  "/redemptions/validate",
  requireBusinessRole({
    permission: BUSINESS_PERMISSIONS.REDEMPTION_VALIDATE,
    billingSuspension: "redeem",
  }),
  validateRedemptionHandler,
);

export default router;
