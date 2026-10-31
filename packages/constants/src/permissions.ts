import { BUSINESS_ROLES, PLATFORM_ROLES, type BusinessRole, type PlatformRole } from "./roles";

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

export type BusinessPermission = (typeof BUSINESS_PERMISSIONS)[keyof typeof BUSINESS_PERMISSIONS];

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

// Platform team permissions (ROADMAP Phase 1). Platform roles never grant
// access to a business's own dashboard routes; those use BUSINESS_PERMISSIONS.
export const PLATFORM_PERMISSIONS = {
  BUSINESS_VIEW: "platform:business:view",
  BUSINESS_MANAGE: "platform:business:manage",
  USER_VIEW: "platform:user:view",
  USER_MANAGE: "platform:user:manage",
  DEVICE_MANAGE: "platform:device:manage",
  AUDIT_VIEW: "platform:audit:view",
  ANALYTICS_VIEW: "platform:analytics:view",
  BILLING_VIEW: "platform:billing:view",
  BILLING_MANAGE: "platform:billing:manage",
  TEAM_MANAGE: "platform:team:manage",
} as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

const P = PLATFORM_PERMISSIONS;

export const DEFAULT_PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  [PLATFORM_ROLES.SUPER_ADMIN]: Object.values(PLATFORM_PERMISSIONS),
  // Day-to-day operations: onboarding, stampers, account actions.
  [PLATFORM_ROLES.ADMIN]: [
    P.BUSINESS_VIEW,
    P.BUSINESS_MANAGE,
    P.USER_VIEW,
    P.USER_MANAGE,
    P.DEVICE_MANAGE,
    P.AUDIT_VIEW,
    P.ANALYTICS_VIEW,
    P.BILLING_VIEW,
  ],
  // Read-only, for answering customer and business questions.
  [PLATFORM_ROLES.SUPPORT]: [P.BUSINESS_VIEW, P.USER_VIEW, P.AUDIT_VIEW, P.ANALYTICS_VIEW],
  [PLATFORM_ROLES.FINANCE]: [P.BUSINESS_VIEW, P.BILLING_VIEW, P.BILLING_MANAGE, P.ANALYTICS_VIEW],
};
