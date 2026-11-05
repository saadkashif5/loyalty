import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { BILLING_CYCLE, SUBSCRIPTION_STATUS } from "@taptapsell/constants";

const limit = { type: Number, default: null, min: 0 };

const planSnapshotSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    version: { type: Number, required: true },
    priceMonthlyPkr: { type: Number, required: true },
    priceAnnualPkr: { type: Number, required: true },
    limits: {
      branches: limit,
      programs: limit,
      stampers: limit,
      staff: limit,
      customers: limit,
    },
    // Absent on snapshots taken before flags existed: everything allowed.
    flags: {
      counterMode: { type: Boolean },
      welcomeStamp: { type: Boolean },
      stampExpiry: { type: Boolean },
    },
  },
  { _id: false },
);

export const CHARGE_KIND = {
  PRORATION: "PRORATION",
  HARDWARE: "HARDWARE",
  OTHER: "OTHER",
} as const;

// Billed on the next invoice, then removed from here.
const chargeSchema = new Schema({
  kind: { type: String, enum: Object.values(CHARGE_KIND), required: true },
  description: { type: String, required: true, maxlength: 200 },
  quantity: { type: Number, required: true, min: 1 },
  unitPkr: { type: Number, required: true, min: 0 },
  amountPkr: { type: Number, required: true, min: 0 },
});

// A plan or cycle change waiting for the paid period to end.
const scheduledChangeSchema = new Schema(
  {
    plan: { type: planSnapshotSchema, required: true },
    billingCycle: { type: String, enum: Object.values(BILLING_CYCLE), required: true },
    effectiveAt: { type: Date, required: true },
  },
  { _id: false },
);

// A coupon applied to this business, copied in so later edits to the coupon
// do not change what was promised.
const appliedCouponSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    code: { type: String, required: true },
    percentOff: { type: Number, default: null },
    amountOffPkr: { type: Number, default: null },
    invoicesLeft: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// One per business. `plan` is a snapshot taken when the plan was chosen, so a
// later price or limit change on the Plan does not affect this business.
const subscriptionSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, unique: true },
    plan: { type: planSnapshotSchema, required: true },
    billingCycle: {
      type: String,
      enum: Object.values(BILLING_CYCLE),
      default: BILLING_CYCLE.MONTHLY,
    },
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.TRIALING,
    },
    trialDays: { type: Number, default: 30 },
    // Applied to every invoice; 100 makes the account complimentary.
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    pendingCharges: { type: [chargeSchema], default: [] },
    scheduledChange: { type: scheduledChangeSchema, default: null },
    coupon: { type: appliedCouponSchema, default: null },
    // Codes this business has used; each works once per business.
    couponsUsed: { type: [String], default: [] },
    // From credit notes; taken off the next invoices' totals.
    creditBalancePkr: { type: Number, default: 0, min: 0 },
    // Set when the owner accepts the invitation: the trial starts then.
    trialEndsAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    graceEndsAt: { type: Date, default: null },
    suspendedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    // Remembers which reminder was last sent, so each one goes out once.
    lastReminderKey: { type: String, default: null },
    // Last reminder the finance team sent by hand; at most one a day.
    lastManualReminderAt: { type: Date, default: null },
  },
  { timestamps: true },
);

subscriptionSchema.index({ status: 1, trialEndsAt: 1 });
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ status: 1, graceEndsAt: 1 });
subscriptionSchema.index({ "scheduledChange.effectiveAt": 1 }, { sparse: true });

export type SubscriptionDocument = HydratedDocument<InferSchemaType<typeof subscriptionSchema>>;
export const Subscription = model("Subscription", subscriptionSchema, "subscriptions");
