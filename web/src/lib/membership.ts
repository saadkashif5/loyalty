import { cache } from "react";
import { notFound } from "next/navigation";
import {
  DEFAULT_ROLE_PERMISSIONS,
  type BusinessPermission,
  type BusinessRole,
} from "@taptapsell/constants";
import { apiFetch } from "./api";

export interface Membership {
  role: BusinessRole;
  /** Branches this person works at; empty means every branch. */
  branchIds: string[];
  business: {
    _id: string;
    name: string;
    category: string;
    status: string;
    suspension?: { kind?: "ADMIN" | "BILLING"; reason?: string; at?: string };
  } | null;
}

export const getMemberships = cache(() => apiFetch<Membership[]>("/businesses"));

/** The signed-in person's role at this business, once per request. */
export const getMembership = cache(async (businessId: string) => {
  const membership = (await getMemberships()).find((m) => m.business?._id === businessId);
  if (!membership?.business) notFound();
  return membership as Membership & { business: NonNullable<Membership["business"]> };
});

/**
 * Hides screens and buttons a role cannot use. The API enforces the same
 * matrix on every request; this only avoids offering actions that would fail.
 */
export function can(role: BusinessRole, permission: BusinessPermission): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
