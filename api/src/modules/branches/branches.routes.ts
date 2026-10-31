import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { requireBusinessRole } from "@/middleware/requireBusinessRole";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import {
  createBranchHandler,
  listBranchesHandler,
  getBranchHandler,
  updateBranchHandler,
} from "./branches.controller";

// Mounted at /api/v1/businesses/:businessId/branches
const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get(
  "/",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.CUSTOMER_VIEW }),
  listBranchesHandler,
);
router.get(
  "/:branchId",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.CUSTOMER_VIEW }),
  getBranchHandler,
);
router.post(
  "/",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.BRANCH_MANAGE }),
  createBranchHandler,
);
router.patch(
  "/:branchId",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.BRANCH_MANAGE }),
  updateBranchHandler,
);

export default router;
