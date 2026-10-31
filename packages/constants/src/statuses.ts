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
