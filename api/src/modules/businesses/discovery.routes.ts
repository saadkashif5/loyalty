import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import * as service from "./discovery.service";

// Unauthenticated discovery surface (/api/v1/discover). Exposes only public
// business/program information — see discovery.service for what is withheld.
const router = Router();

router.get(
  "/businesses",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const query = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;

    const { items, total } = await service.searchBusinesses({ query, category, page, limit });
    sendSuccess(res, items, { meta: { page, limit, total } });
  }),
);

router.get(
  "/businesses/:businessId",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.getPublicBusiness(req.params.businessId));
  }),
);

// Where the QR code on the physical stamper lands.
router.get(
  "/stampers/:deviceIdentifier",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.resolveStamperCode(req.params.deviceIdentifier));
  }),
);

export default router;
