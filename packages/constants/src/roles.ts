// Platform-level roles (users.role is NOT used for business authorization — see business roles below)
export const PLATFORM_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  SUPPORT: "SUPPORT",
  FINANCE: "FINANCE",
} as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES];

// Business-scoped roles, resolved per (userId, businessId) via business_members.
// A single user can hold different roles across different businesses.
export const BUSINESS_ROLES = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
} as const;

export type BusinessRole = (typeof BUSINESS_ROLES)[keyof typeof BUSINESS_ROLES];

export const BUSINESS_ROLE_HIERARCHY: Record<BusinessRole, number> = {
  OWNER: 3,
  MANAGER: 2,
  STAFF: 1,
};
