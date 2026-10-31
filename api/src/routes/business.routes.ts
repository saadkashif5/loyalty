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
} from "@/modules/devices/devices.controller";
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
router.get(
  "/devices",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.DEVICE_MANAGE }),
  listDevicesHandler,
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
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.REDEMPTION_VALIDATE }),
  validateRedemptionHandler,
);

export default router;
