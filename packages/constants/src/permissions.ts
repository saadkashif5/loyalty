import { BUSINESS_ROLES, type BusinessRole } from "./roles";

// Central permission matrix per PRD §5.2 — enforced by authorization middleware,
// never left to individual controllers to decide ad hoc.
export const BUSINESS_PERMISSIONS = {
  BUSINESS_MANAGE_PROFILE: "business:manage_profile",
  BUSINESS_DELETE: "business:delete",
  BUSINESS_TRANSFER_OWNERSHIP: "business:transfer_ownership",
  BUSINESS_MANAGE_BILLING: "business:manage_billing",

  BRANCH_MANAGE: "branch:manage",

  MEMBER_MANAGE: "member:manage",
  MEMBER_VIEW: "member:view",

  PROGRAM_MANAGE: "program:manage",
  PROGRAM_VIEW: "program:view",

  DEVICE_MANAGE: "device:manage",
  DEVICE_REPORT_PROBLEM: "device:report_problem",

  CUSTOMER_VIEW: "customer:view",

  STAMP_VIEW: "stamp:view",
  STAMP_ISSUE_MANUAL: "stamp:issue_manual",

  REWARD_MANAGE: "reward:manage",
  REWARD_VIEW: "reward:view",

  REDEMPTION_VALIDATE: "redemption:validate",
  REDEMPTION_VIEW: "redemption:view",

  ANALYTICS_VIEW: "analytics:view",

  CAMPAIGN_MANAGE: "campaign:manage",
} as const;

export type BusinessPermission =
  (typeof BUSINESS_PERMISSIONS)[keyof typeof BUSINESS_PERMISSIONS];

const { OWNER, MANAGER, STAFF } = BUSINESS_ROLES;

// MVP default matrix. MANAGER staff-management and STAFF permissions are
// intentionally minimal per PRD §5.2 ("MVP should minimize staff permissions").
export const DEFAULT_ROLE_PERMISSIONS: Record<BusinessRole, BusinessPermission[]> = {
  [OWNER]: Object.values(BUSINESS_PERMISSIONS),
  [MANAGER]: [
    BUSINESS_PERMISSIONS.BRANCH_MANAGE,
    BUSINESS_PERMISSIONS.MEMBER_VIEW,
    BUSINESS_PERMISSIONS.PROGRAM_MANAGE,
    BUSINESS_PERMISSIONS.PROGRAM_VIEW,
    BUSINESS_PERMISSIONS.DEVICE_MANAGE,
    BUSINESS_PERMISSIONS.CUSTOMER_VIEW,
    BUSINESS_PERMISSIONS.STAMP_VIEW,
    BUSINESS_PERMISSIONS.STAMP_ISSUE_MANUAL,
    BUSINESS_PERMISSIONS.REWARD_MANAGE,
    BUSINESS_PERMISSIONS.REWARD_VIEW,
    BUSINESS_PERMISSIONS.REDEMPTION_VALIDATE,
    BUSINESS_PERMISSIONS.REDEMPTION_VIEW,
    BUSINESS_PERMISSIONS.ANALYTICS_VIEW,
  ],
  [STAFF]: [
    BUSINESS_PERMISSIONS.CUSTOMER_VIEW,
    BUSINESS_PERMISSIONS.STAMP_VIEW,
    BUSINESS_PERMISSIONS.REWARD_VIEW,
    BUSINESS_PERMISSIONS.REDEMPTION_VALIDATE,
    BUSINESS_PERMISSIONS.REDEMPTION_VIEW,
    BUSINESS_PERMISSIONS.DEVICE_REPORT_PROBLEM,
  ],
};
