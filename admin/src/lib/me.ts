import { cache } from "react";
import { redirect } from "next/navigation";
import {
  DEFAULT_PLATFORM_ROLE_PERMISSIONS,
  type PlatformPermission,
  type PlatformRole,
} from "@taptapsell/constants";
import { apiFetch } from "./api";

export interface Me {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
}

/** The signed-in team member, once per request. Anyone not on the team is sent away. */
export const getMe = cache(async (): Promise<Me & { platformRole: PlatformRole }> => {
  const me = await apiFetch<Me>("/users/me");
  if (!me.platformRole) redirect("/login?denied=1");
  return me as Me & { platformRole: PlatformRole };
});

/**
 * Hides actions a role cannot take. The API enforces the same matrix on every
 * request; this only keeps the console from offering buttons that would fail.
 */
export function can(role: PlatformRole, permission: PlatformPermission): boolean {
  return DEFAULT_PLATFORM_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** For pages a role cannot use at all: back to the overview rather than an error. */
export async function requirePermission(permission: PlatformPermission) {
  const me = await getMe();
  if (!can(me.platformRole, permission)) redirect("/");
  return me;
}
