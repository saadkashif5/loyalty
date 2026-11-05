import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { cached } from "@/services/cache.service";
import { listPlans } from "./plans.service";

// Mounted at /api/v1/plans. The prices on the public pricing page: plans that
// are on offer, with nothing internal (versions, ids of hidden plans).
const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const plans = await cached("public-plans", 300, async () =>
      (await listPlans({ publicOnly: true })).map((p) => ({
        code: p.code,
        name: p.name,
        description: p.description ?? null,
        priceMonthlyPkr: p.priceMonthlyPkr,
        priceAnnualPkr: p.priceAnnualPkr,
        limits: p.limits,
        features: p.features,
      })),
    );
    sendSuccess(res, plans);
  }),
);

export default router;
