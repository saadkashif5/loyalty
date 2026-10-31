import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { requireBusinessRole } from "@/middleware/requireBusinessRole";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import {
  listMyBusinessesHandler,
  getBusinessHandler,
  updateBusinessHandler,
} from "./businesses.controller";

const router = Router();

router.use(requireAuth);

// No create route: businesses are created by the platform and owners join by
// invitation (POST /admin/businesses, then /invitations/:token/accept).
router.get("/", listMyBusinessesHandler);

router.get(
  "/:businessId",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.CUSTOMER_VIEW }),
  getBusinessHandler,
);

router.patch(
  "/:businessId",
  requireBusinessRole({ permission: BUSINESS_PERMISSIONS.BUSINESS_MANAGE_PROFILE }),
  updateBusinessHandler,
);

export default router;
