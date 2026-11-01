"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { API_BASE_URL, apiFetch, ApiRequestError } from "@/lib/api";
import { clientHeaders } from "@/lib/forwarding";
import { getAccessToken } from "@/lib/session";

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

function optionalNumber(formData: FormData, name: string): number | undefined {
  const value = text(formData, name);
  return value === undefined ? undefined : Number(value);
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
        maxStampsPerDay: Number(formData.get("maxStampsPerDay") ?? 3),
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
        maxStampsPerDay: Number(formData.get("maxStampsPerDay")),
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
        validForDays: optionalNumber(formData, "validForDays"),
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
        validForDays: optionalNumber(formData, "validForDays"),
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

// ---- Counter mode, manual stamps and alerts --------------------------------------------

export interface CounterLookup {
  customer: { name: string; phone: string | null; email: string | null };
  card: { program: string; stampCount: number; requiredStamps: number };
  expiresAt: string;
}

export interface CounterState {
  error?: string;
  code?: string;
  lookup?: CounterLookup;
  done?: { stampCount: number; requiredStamps: number; rewards: string[] };
}

/** Step one: show staff whose card this is before anything is recorded. */
export async function lookupCounterAction(
  businessId: string,
  _prev: CounterState,
  formData: FormData,
): Promise<CounterState> {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  try {
    const lookup = await apiFetch<CounterLookup>(`/businesses/${businessId}/counter/lookup`, {
      method: "POST",
      body: { code },
    });
    return { code, lookup };
  } catch (error) {
    return { error: messageFrom(error, "That code did not work.") };
  }
}

interface StampResponse {
  card: { stampCount: number; requiredStamps: number };
  unlockedRewards: Array<{ rewardName: string }>;
}

/** Step two: add the stamp. The idempotency key comes from the form, so a double tap is one stamp. */
export async function counterStampAction(
  businessId: string,
  prev: CounterState,
  formData: FormData,
): Promise<CounterState> {
  try {
    const result = await apiFetch<StampResponse>(`/businesses/${businessId}/counter/stamp`, {
      method: "POST",
      body: { code: prev.code, branchId: text(formData, "branchId") },
      idempotencyKey: text(formData, "idempotencyKey"),
    });
    refresh(businessId);
    return {
      done: {
        stampCount: result.card.stampCount,
        requiredStamps: result.card.requiredStamps,
        rewards: result.unlockedRewards.map((r) => r.rewardName),
      },
    };
  } catch (error) {
    return { ...prev, error: messageFrom(error, "Could not add the stamp.") };
  }
}

/** Managers and owners: stamp a customer found by search. */
export async function manualStampAction(
  businessId: string,
  loyaltyCardId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not add the stamp.", () =>
    apiFetch(`/businesses/${businessId}/stamps/manual`, {
      method: "POST",
      body: { loyaltyCardId, branchId: text(formData, "branchId") },
      idempotencyKey: text(formData, "idempotencyKey"),
    }),
  );
}

export async function reviewFlagAction(
  businessId: string,
  flagId: string,
  status: "DISMISSED" | "CONFIRMED",
): Promise<void> {
  await apiFetch(`/businesses/${businessId}/fraud-flags/${flagId}`, {
    method: "PATCH",
    body: { status },
  });
  refresh(businessId);
}

export async function updateStaffCapAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not save the limit.", () =>
    apiFetch(`/businesses/${businessId}`, {
      method: "PATCH",
      body: { staffDailyStampCap: Number(formData.get("staffDailyStampCap")) },
    }),
  );
}

// ---- Billing ------------------------------------------------------------------

export async function changePlanAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return run(businessId, "Could not change the plan.", () =>
    apiFetch(`/businesses/${businessId}/billing/plan`, {
      method: "POST",
      body: {
        planCode: text(formData, "planCode"),
        billingCycle: text(formData, "billingCycle"),
      },
    }),
  );
}

export async function cancelPlanChangeAction(businessId: string): Promise<FormState> {
  return run(businessId, "Could not cancel the plan change.", () =>
    apiFetch(`/businesses/${businessId}/billing/scheduled-change`, { method: "DELETE" }),
  );
}

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

/** Sends a bank or Raast receipt for an open invoice; Finance reviews it. */
export async function uploadReceiptAction(
  businessId: string,
  invoiceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Attach a photo or PDF of the receipt." };
  }
  if (file.size > MAX_RECEIPT_BYTES) return { error: "The file must be 5 MB or smaller." };

  const body = new FormData();
  body.set("file", file, file.name);
  for (const name of ["method", "amountPkr", "reference", "note"]) {
    const value = text(formData, name);
    if (value) body.set(name, value);
  }

  const token = await getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/businesses/${businessId}/invoices/${invoiceId}/proofs`,
    {
      method: "POST",
      headers: {
        ...(await clientHeaders()),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return { error: payload?.error?.message ?? "Could not upload the receipt." };
  }
  refresh(businessId);
  return { saved: true };
}
