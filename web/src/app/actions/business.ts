"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";

export interface FormState {
  error?: string;
  saved?: boolean;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

function text(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? "").trim();
  return value || undefined;
}

/** Everything under the business re-renders, so the setup checklist and lists stay current. */
function refresh(businessId: string) {
  revalidatePath(`/b/${businessId}`, "layout");
}

async function run(
  businessId: string,
  fallback: string,
  call: () => Promise<unknown>,
): Promise<FormState> {
  try {
    await call();
  } catch (error) {
    return { error: messageFrom(error, fallback) };
  }
  refresh(businessId);
  return { saved: true };
}

// ---- Business profile ----------------------------------------------------------

export async function updateBusinessProfileAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not save the profile.", () =>
    apiFetch(`/businesses/${businessId}`, {
      method: "PATCH",
      body: {
        name: text(formData, "name"),
        category: text(formData, "category"),
        description: text(formData, "description"),
        contact: {
          phone: text(formData, "phone"),
          email: text(formData, "email"),
          address: text(formData, "address"),
        },
      },
    }),
  );
}

// ---- Branches ------------------------------------------------------------------------

export async function createBranchAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not create the branch.", () =>
    apiFetch(`/businesses/${businessId}/branches`, {
      method: "POST",
      body: { name: text(formData, "name"), address: text(formData, "address") },
    }),
  );
}

export async function updateBranchAction(
  businessId: string,
  branchId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not save the branch.", () =>
    apiFetch(`/businesses/${businessId}/branches/${branchId}`, {
      method: "PATCH",
      body: {
        name: text(formData, "name"),
        address: text(formData, "address"),
        status: text(formData, "status"),
      },
    }),
  );
}

// ---- Programs and rewards ---------------------------------------------------------------

export async function createProgramAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not create the program.", () =>
    apiFetch(`/businesses/${businessId}/programs`, {
      method: "POST",
      body: {
        name: text(formData, "name"),
        description: text(formData, "description"),
        requiredStamps: Number(formData.get("requiredStamps")),
        minMinutesBetweenStamps: Number(formData.get("minMinutesBetweenStamps") ?? 5),
      },
    }),
  );
}

export async function updateProgramAction(
  businessId: string,
  programId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not save the program.", () =>
    apiFetch(`/businesses/${businessId}/programs/${programId}`, {
      method: "PATCH",
      body: {
        name: text(formData, "name"),
        description: text(formData, "description") ?? "",
        terms: text(formData, "terms") ?? "",
        requiredStamps: Number(formData.get("requiredStamps")),
        minMinutesBetweenStamps: Number(formData.get("minMinutesBetweenStamps")),
        status: text(formData, "status"),
      },
    }),
  );
}

export async function createRewardAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not create the reward.", () =>
    apiFetch(`/businesses/${businessId}/rewards`, {
      method: "POST",
      body: {
        programId: text(formData, "programId"),
        name: text(formData, "name"),
        description: text(formData, "description"),
        type: text(formData, "type") ?? "FREE_ITEM",
        requiredStamps: Number(formData.get("requiredStamps")),
      },
    }),
  );
}

export async function updateRewardAction(
  businessId: string,
  rewardId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not save the reward.", () =>
    apiFetch(`/businesses/${businessId}/rewards/${rewardId}`, {
      method: "PATCH",
      body: {
        name: text(formData, "name"),
        description: text(formData, "description") ?? "",
        type: text(formData, "type"),
        requiredStamps: Number(formData.get("requiredStamps")),
        status: text(formData, "status"),
      },
    }),
  );
}

// ---- Stampers ----------------------------------------------------------------------

export async function activateDeviceAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not activate the stamper.", () =>
    apiFetch(`/businesses/${businessId}/devices/activate`, {
      method: "POST",
      body: {
        deviceIdentifier: String(formData.get("deviceIdentifier") ?? "")
          .trim()
          .toUpperCase(),
        activationCode: String(formData.get("activationCode") ?? "")
          .trim()
          .toUpperCase(),
        branchId: text(formData, "branchId"),
      },
    }),
  );
}

export async function revokeDeviceAction(businessId: string, deviceId: string): Promise<void> {
  await apiFetch(`/businesses/${businessId}/devices/${deviceId}/revoke`, {
    method: "POST",
    body: { reason: "Revoked from dashboard" },
  });
  refresh(businessId);
}

export async function reportDeviceProblemAction(
  businessId: string,
  deviceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not send the report.", () =>
    apiFetch(`/businesses/${businessId}/devices/${deviceId}/report`, {
      method: "POST",
      body: { reason: text(formData, "reason"), note: text(formData, "note") },
    }),
  );
}

// ---- Redemption at the counter ------------------------------------------------------------

interface RedeemState {
  error?: string;
  success?: string;
}

export async function validateRedemptionAction(
  businessId: string,
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  const code = String(formData.get("redemptionCode") ?? "")
    .trim()
    .toUpperCase();

  try {
    const redemption = await apiFetch<{ rewardId: { name: string } }>(
      `/businesses/${businessId}/redemptions/validate`,
      { method: "POST", body: { redemptionCode: code, branchId: text(formData, "branchId") } },
    );
    return { success: `Redeemed: ${redemption.rewardId?.name ?? "reward"}` };
  } catch (error) {
    return { error: messageFrom(error, "Could not validate this code.") };
  }
}

// ---- Staff --------------------------------------------------------------------------------

export async function inviteMemberAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not invite this person.", () =>
    apiFetch(`/businesses/${businessId}/members`, {
      method: "POST",
      body: { email: text(formData, "email"), role: text(formData, "role") ?? "STAFF" },
    }),
  );
}

export async function updateMemberAction(
  businessId: string,
  memberId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not save the changes.", () =>
    apiFetch(`/businesses/${businessId}/members/${memberId}`, {
      method: "PATCH",
      body: {
        role: text(formData, "role"),
        status: text(formData, "status"),
        // No branch ticked means every branch.
        branchIds: formData.getAll("branchIds").map(String),
      },
    }),
  );
}

export async function acceptStaffInviteAction(businessId: string): Promise<void> {
  await apiFetch(`/businesses/${businessId}/members/accept`, { method: "POST" });
  redirect(`/b/${businessId}`);
}

export async function declineStaffInviteAction(businessId: string): Promise<void> {
  await apiFetch(`/businesses/${businessId}/members/decline`, { method: "POST" });
  revalidatePath("/businesses");
}
