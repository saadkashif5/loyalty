import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { requireBusinessRole } from "@/middleware/requireBusinessRole";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import {
  createBusinessHandler,
  listMyBusinessesHandler,
  getBusinessHandler,
  updateBusinessHandler,
} from "./businesses.controller";

const router = Router();

router.use(requireAuth);

router.post("/", createBusinessHandler);
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
