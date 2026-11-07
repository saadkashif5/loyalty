import { PaymentProof, Subscription } from "@/models";
import { PROOF_STATUS } from "@/models/PaymentProof";
import { CHARGE_KIND } from "@/models/Subscription";
import { ApiError } from "@/utils/ApiError";
import { recordAudit, AUDIT_ACTIONS } from "@/services/audit.service";
import { SUBSCRIPTION_STATUS, type BillingCycle } from "@taptapsell/constants";
import type { AddChargeInput, ChangeSubscriptionPlanInput } from "@taptapsell/validation";
import { countUsage } from "./entitlements.service";
import { findActivePlan } from "./plans.service";
import { reissueOpenInvoice } from "./invoices.service";
import { quotePlanChange } from "./planQuote";
import { emailOwners, getSubscriptionOrThrow, snapshot } from "./subscriptions.service";
import { BRAND } from "@taptapsell/brand";

const REISSUE_REASON = "Replaced after a plan change";
const RECEIPT_WAITING = "We are checking your receipt. Try again once it has been reviewed.";

function hasPendingReceipt(businessId: string) {
  return PaymentProof.exists({ businessId, status: PROOF_STATUS.PENDING });
}

/** The owner's own plan change. See quotePlanChange for when it takes effect. */
export async function changeOwnPlan(
  actorUserId: string,
  businessId: string,
  input: ChangeSubscriptionPlanInput,
) {
  const subscription = await getSubscriptionOrThrow(businessId);
  if (subscription.status === SUBSCRIPTION_STATUS.CANCELLED) {
    throw ApiError.badRequest("This subscription is cancelled. Please contact the team.");
  }
  const plan = await findActivePlan(input.planCode);
  if (!plan.isPublic && plan.code !== subscription.plan.code) {
    throw ApiError.notFound("Plan not found");
  }

  const cycle = (input.billingCycle ?? subscription.billingCycle) as BillingCycle;
  const quote = quotePlanChange(subscription, plan, cycle, await countUsage(businessId));
  if (quote.kind === "CURRENT") throw ApiError.badRequest("You are already on this plan");
  if (quote.kind === "CONTACT_TEAM") {
    throw ApiError.badRequest("To upgrade an annual plan, please contact the team.");
  }
  if (quote.blockers.length > 0) {
    throw new ApiError(400, "PLAN_TOO_SMALL", quote.blockers.join(" "));
  }
  // A receipt under review was paid against the open invoice, which this would replace.
  if (await hasPendingReceipt(businessId)) throw ApiError.conflict(RECEIPT_WAITING);

  const terms = snapshot(plan);
  const update =
    quote.kind === "PERIOD_END"
      ? {
          $set: {
            scheduledChange: { plan: terms, billingCycle: cycle, effectiveAt: quote.effectiveAt },
          },
        }
      : {
          $set: { plan: terms, billingCycle: cycle, scheduledChange: null },
          ...(quote.chargePkr > 0
            ? {
                $push: {
                  pendingCharges: {
                    kind: CHARGE_KIND.PRORATION,
                    description: `Upgrade from ${subscription.plan.name} to ${plan.name} for the rest of the paid period`,
                    quantity: 1,
                    unitPkr: quote.chargePkr,
                    amountPkr: quote.chargePkr,
                  },
                },
              }
            : {}),
        };
  // Two clicks must not charge twice: the second finds the plan already changed.
  const changed = await Subscription.findOneAndUpdate(
    { _id: subscription._id, "plan.code": subscription.plan.code },
    update,
    { new: true },
  );
  if (!changed) throw ApiError.conflict("Your plan changed just now. Refresh and try again.");

  await reissueOpenInvoice(changed, actorUserId, REISSUE_REASON);

  await recordAudit({
    actorUserId,
    businessId,
    action:
      quote.kind === "PERIOD_END"
        ? AUDIT_ACTIONS.SUBSCRIPTION_CHANGE_SCHEDULED
        : AUDIT_ACTIONS.SUBSCRIPTION_PLAN_CHANGED,
    resourceType: "Subscription",
    resourceId: subscription._id,
    metadata: {
      from: subscription.plan.code,
      to: plan.code,
      billingCycle: cycle,
      chargePkr: quote.chargePkr,
      effectiveAt: quote.effectiveAt,
    },
  });
  await emailOwners(
    businessId,
    `Your ${BRAND.name} plan is changing to ${plan.name}`,
    quote.kind === "PERIOD_END"
      ? `You will move to the ${plan.name} plan when your paid period ends.`
      : `You are now on the ${plan.name} plan.` +
          (quote.chargePkr > 0
            ? ` PKR ${quote.chargePkr.toLocaleString("en-PK")} for the rest of this period will be added to your next invoice.`
            : ""),
  );

  return { quote, subscription: await Subscription.findById(subscription._id) };
}

export async function cancelScheduledChange(actorUserId: string, businessId: string) {
  const subscription = await getSubscriptionOrThrow(businessId);
  if (!subscription.scheduledChange) throw ApiError.badRequest("No plan change is scheduled");
  if (await hasPendingReceipt(businessId)) throw ApiError.conflict(RECEIPT_WAITING);

  const to = subscription.scheduledChange.plan.code;
  subscription.scheduledChange = null;
  await subscription.save();
  await reissueOpenInvoice(subscription, actorUserId, REISSUE_REASON);

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_CHANGE_CANCELLED,
    resourceType: "Subscription",
    resourceId: subscription._id,
    metadata: { to },
  });
  return subscription;
}

/** An extra on the next invoice, such as a stamper or a replacement. */
export async function addCharge(actorUserId: string, businessId: string, input: AddChargeInput) {
  const subscription = await getSubscriptionOrThrow(businessId);
  const amountPkr = input.unitPkr * input.quantity;
  const updated = await Subscription.findByIdAndUpdate(
    subscription._id,
    { $push: { pendingCharges: { ...input, amountPkr } } },
    { new: true },
  );

  // Under review, the open invoice must stay as paid; the charge waits for the next one.
  if (updated && !(await hasPendingReceipt(businessId))) {
    await reissueOpenInvoice(updated, actorUserId, "Replaced to add a charge");
  }

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_CHARGE_ADDED,
    resourceType: "Subscription",
    resourceId: subscription._id,
    metadata: { kind: input.kind, description: input.description, amountPkr },
  });
  return Subscription.findById(subscription._id);
}

export async function removeCharge(actorUserId: string, businessId: string, chargeId: string) {
  const removed = await Subscription.findOneAndUpdate(
    { businessId, "pendingCharges._id": chargeId },
    { $pull: { pendingCharges: { _id: chargeId } } },
  );
  if (!removed) throw ApiError.notFound("Charge not found. It may already be on an invoice.");

  await recordAudit({
    actorUserId,
    businessId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_CHARGE_REMOVED,
    resourceType: "Subscription",
    resourceId: removed._id,
    metadata: { chargeId },
  });
  return Subscription.findById(removed._id);
}
