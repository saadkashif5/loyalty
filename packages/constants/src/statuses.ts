export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DELETED: "DELETED",
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const BUSINESS_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type BusinessStatus = (typeof BUSINESS_STATUS)[keyof typeof BUSINESS_STATUS];

export const MEMBER_STATUS = {
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
} as const;
export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];

export const BRANCH_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type BranchStatus = (typeof BRANCH_STATUS)[keyof typeof BRANCH_STATUS];

export const PROGRAM_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type ProgramStatus = (typeof PROGRAM_STATUS)[keyof typeof PROGRAM_STATUS];

export const LOYALTY_CARD_STATUS = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  EXPIRED: "EXPIRED",
} as const;
export type LoyaltyCardStatus = (typeof LOYALTY_CARD_STATUS)[keyof typeof LOYALTY_CARD_STATUS];

// NFC device lifecycle — PRD §39
export const DEVICE_STATUS = {
  UNASSIGNED: "UNASSIGNED",
  ASSIGNED: "ASSIGNED",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  REVOKED: "REVOKED",
  REPLACED: "REPLACED",
} as const;
export type DeviceStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS];

// How a stamper proves that a tap is fresh. Each type has a verifier in
// api/src/modules/taps/verifiers, so changing chips is a per-device setting.
// STATIC tags carry only the public identifier and cannot stop replayed URLs;
// they remain for the legacy in-app flow until all stampers are replaced.
export const TAG_TYPE = {
  STATIC: "STATIC",
  NTAG21X_MIRROR: "NTAG21X_MIRROR",
} as const;
export type TagType = (typeof TAG_TYPE)[keyof typeof TAG_TYPE];

export const STAMP_SOURCE = {
  NFC: "NFC",
  QR: "QR",
  ADMIN: "ADMIN",
  // Added by staff at the counter after scanning the customer's card code.
  STAFF: "STAFF",
} as const;
export type StampSource = (typeof STAMP_SOURCE)[keyof typeof STAMP_SOURCE];

export const STAMP_STATUS = {
  VALID: "VALID",
  REJECTED: "REJECTED",
} as const;
export type StampStatus = (typeof STAMP_STATUS)[keyof typeof STAMP_STATUS];

export const REWARD_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type RewardStatus = (typeof REWARD_STATUS)[keyof typeof REWARD_STATUS];

export const REDEMPTION_STATUS = {
  PENDING: "PENDING",
  REDEEMED: "REDEEMED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUS)[keyof typeof REDEMPTION_STATUS];

export const NOTIFICATION_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  READ: "READ",
} as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

export const FRAUD_FLAG_STATUS = {
  OPEN: "OPEN",
  DISMISSED: "DISMISSED",
  CONFIRMED: "CONFIRMED",
} as const;
export type FraudFlagStatus = (typeof FRAUD_FLAG_STATUS)[keyof typeof FRAUD_FLAG_STATUS];

export const FRAUD_FLAG_TYPE = {
  /** Many stamps from one stamper in a short time. */
  DEVICE_BURST: "DEVICE_BURST",
  /** A stamper URL used again (copied, shared or bookmarked). */
  TAP_REPLAYED: "TAP_REPLAYED",
  /** A tag reporting a different chip than the one bound to the stamper. */
  TAG_MISMATCH: "TAG_MISMATCH",
  /** A staff member reached their daily stamp limit. */
  STAFF_DAILY_CAP: "STAFF_DAILY_CAP",
} as const;
export type FraudFlagType = (typeof FRAUD_FLAG_TYPE)[keyof typeof FRAUD_FLAG_TYPE];

// ---- Billing (ROADMAP Phase 3) ------------------------------------------------------

export const SUBSCRIPTION_STATUS = {
  TRIALING: "TRIALING",
  ACTIVE: "ACTIVE",
  /** Period ended unpaid; still working during the grace period. */
  PAST_DUE: "PAST_DUE",
  /** Grace period over: the business is suspended until it pays. */
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
} as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const BILLING_CYCLE = { MONTHLY: "MONTHLY", ANNUAL: "ANNUAL" } as const;
export type BillingCycle = (typeof BILLING_CYCLE)[keyof typeof BILLING_CYCLE];

export const PAYMENT_METHOD = {
  BANK_TRANSFER: "BANK_TRANSFER",
  RAAST: "RAAST",
  CASH: "CASH",
  CHEQUE: "CHEQUE",
  CARD: "CARD",
  OTHER: "OTHER",
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

/** Why a business is suspended: billing suspensions lift automatically on payment. */
export const SUSPENSION_KIND = { ADMIN: "ADMIN", BILLING: "BILLING" } as const;
export type SuspensionKind = (typeof SUSPENSION_KIND)[keyof typeof SUSPENSION_KIND];
