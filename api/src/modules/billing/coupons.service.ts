import { isValidObjectId } from "mongoose";
import { Coupon, Subscription } from "@/models";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import type { CreateCouponInput } from "@taptapsell/validation";
import { reissueOpenInvoice } from "./invoices.service";

export async function listCoupons() {
  return Coupon.find().sort({ createdAt: -1 }).limit(200);
}

export async function createCoupon(actorUserId: string, input: CreateCouponInput) {
  if (await Coupon.exists({ code: input.code })) {
    throw ApiError.conflict("A coupon with this code already exists");
  }
  const coupon = await Coupon.create({ ...input, createdBy: actorUserId });
  await recordAudit({
    actorUserId,
    action: AUDIT_ACTIONS.COUPON_CREATED,
    resourceType: "Coupon",
    resourceId: coupon._id,
    metadata: {
      code: coupon.code,
      percentOff: coupon.percentOff,
      amountOffPkr: coupon.amountOffPkr,
    },
  });
  return coupon;
}

/** Coupons are switched off rather than deleted: invoices refer to them. */
export async function setCouponActive(actorUserId: string, couponId: string, active: boolean) {
  if (!isValidObjectId(couponId)) throw ApiError.notFound("Coupon not found");
  const coupon = await Coupon.findByIdAndUpdate(couponId, { active }, { new: true });
  if (!coupon) throw ApiError.notFound("Coupon not found");
  await recordAudit({
    actorUserId,
    action: AUDIT_ACTIONS.COUPON_UPDATED,
    resourceType: "Coupon",
    resourceId: coupon._id,
    metadata: { code: coupon.code, active },
  });
  return coupon;
}

/**
 * Puts a coupon on a business's subscription, by the owner (from Billing) or
 * the finance team. Each code works once per business, and a business holds
 * one coupon at a time; an open invoice is reissued so it applies at once.
 */
export async function applyCoupon(
  actorUserId: string,
  businessId: string,
  code: string,
  options: { replace?: boolean } = {},
) {
  const subscription = await Subscription.findOne({ businessId });
  if (!subscription) throw ApiError.notFound("No subscription for this business");

  const now = new Date();
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon || !coupon.active) throw ApiError.badRequest("This code is not valid.");
  if (coupon.expiresAt && coupon.expiresAt <= now) {
    throw ApiError.badRequest("This code has expired.");
  }
  if (coupon.planCodes.length && !coupon.planCodes.includes(subscription.plan.code)) {
    throw ApiError.badRequest(`This code is not for the ${subscription.plan.name} plan.`);
  }
  if (subscription.couponsUsed.includes(coupon.code)) {
    throw ApiError.conflict("This business has already used this code.");
  }
  if (subscription.coupon?.invoicesLeft && !options.replace) {
    throw ApiError.conflict(`Coupon ${subscription.coupon.code} is still in use.`);
  }

  // Counted atomically so a limited code cannot be over-used.
  const claimed = await Coupon.updateOne(
    {
      _id: coupon._id,
      $or: [{ maxRedemptions: null }, { $expr: { $lt: ["$redemptions", "$maxRedemptions"] } }],
    },
    { $inc: { redemptions: 1 } },
  );
  if (claimed.modifiedCount !== 1) throw ApiError.badRequest("This code has been used up.");

  await Subscription.updateOne(
    { _id: subscription._id },
    {
      $set: {
        coupon: {
          couponId: coupon._id,
          code: coupon.code,
          percentOff: coupon.percentOff,
          amountOffPkr: coupon.amountOffPkr,
          invoicesLeft: coupon.invoices,
        },
      },
      $addToSet: { couponsUsed: coupon.code },
    },
  );
  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.COUPON_APPLIED,
    resourceType: "Subscription",
    resourceId: subscription._id,
    metadata: { code: coupon.code },
  });

  const fresh = (await Subscription.findById(subscription._id))!;
  const invoice = await reissueOpenInvoice(fresh, actorUserId, `Coupon ${coupon.code} applied`);
  return { coupon: fresh.coupon, invoice };
}

export async function removeCoupon(actorUserId: string, businessId: string) {
  const subscription = await Subscription.findOneAndUpdate(
    { businessId, coupon: { $ne: null } },
    { $set: { coupon: null } },
    { new: false },
  );
  if (!subscription) throw ApiError.notFound("This business has no coupon");
  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.COUPON_REMOVED,
    resourceType: "Subscription",
    resourceId: subscription._id,
    metadata: { code: subscription.coupon?.code },
  });
  const fresh = (await Subscription.findById(subscription._id))!;
  await reissueOpenInvoice(fresh, actorUserId, "Coupon removed");
  return { removed: true };
}
