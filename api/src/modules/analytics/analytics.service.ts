import { Types } from "mongoose";
import { LoyaltyCard, LoyaltyProgram, Redemption, Stamp } from "@/models";
import { REDEMPTION_STATUS } from "@taptapsell/constants";

const ACTIVE_WINDOW_DAYS = 30;

/**
 * All figures are derived from recorded transactions — no estimates or inferred
 * conclusions (§36). "Active" means a stamp in the last 30 days.
 */
export async function getBusinessOverview(businessId: string) {
  const objectId = new Types.ObjectId(businessId);
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000);

  const [totalCustomers, activeCustomers, totalStamps, rewardsUnlocked, rewardsRedeemed] =
    await Promise.all([
      LoyaltyCard.countDocuments({ businessId: objectId }),
      Stamp.distinct("customerId", { businessId: objectId, createdAt: { $gte: activeSince } }).then(
        (ids) => ids.length,
      ),
      Stamp.countDocuments({ businessId: objectId }),
      Redemption.countDocuments({ businessId: objectId }),
      Redemption.countDocuments({ businessId: objectId, status: REDEMPTION_STATUS.REDEEMED }),
    ]);

  return {
    totalCustomers,
    activeCustomers,
    totalStamps,
    rewardsUnlocked,
    rewardsRedeemed,
    redemptionRate: rewardsUnlocked > 0 ? rewardsRedeemed / rewardsUnlocked : null,
    averageStampsPerCustomer: totalCustomers > 0 ? totalStamps / totalCustomers : 0,
  };
}

export async function getStampsOverTime(
  businessId: string,
  options: { days: number; branchId?: string },
) {
  const since = new Date(Date.now() - options.days * 86_400_000);
  const match: Record<string, unknown> = {
    businessId: new Types.ObjectId(businessId),
    createdAt: { $gte: since },
  };
  if (options.branchId) match.branchId = new Types.ObjectId(options.branchId);

  return Stamp.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", count: 1 } },
  ]);
}

/** Customers one or two stamps from a reward — the actionable retention list. */
export async function getCustomersNearCompletion(businessId: string, within = 2) {
  const programs = await LoyaltyProgram.find({ businessId }).select("requiredStamps");
  if (programs.length === 0) return [];

  const thresholds = programs.map((p) => ({
    programId: p._id,
    minimum: Math.max(1, p.requiredStamps - within),
  }));

  return LoyaltyCard.find({
    businessId,
    $or: thresholds.map((t) => ({
      programId: t.programId,
      stampCount: { $gte: t.minimum },
    })),
  })
    .populate("customerId", "name email")
    .populate("programId", "name requiredStamps")
    .limit(200);
}
