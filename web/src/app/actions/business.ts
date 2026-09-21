"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";

interface FormState {
  error?: string;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

export async function createBusinessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let businessId: string;

  try {
    const business = await apiFetch<{ _id: string }>("/businesses", {
      method: "POST",
      body: {
        name: String(formData.get("name") ?? ""),
        category: String(formData.get("category") ?? "OTHER"),
        description: String(formData.get("description") ?? "") || undefined,
      },
    });
    businessId = business._id;
  } catch (error) {
    return { error: messageFrom(error, "Could not create the business.") };
  }

  redirect(`/b/${businessId}`);
}

export async function createBranchAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/businesses/${businessId}/branches`, {
      method: "POST",
      body: {
        name: String(formData.get("name") ?? ""),
        address: String(formData.get("address") ?? "") || undefined,
      },
    });
  } catch (error) {
    return { error: messageFrom(error, "Could not create the branch.") };
  }

  revalidatePath(`/b/${businessId}/branches`);
  return {};
}

export async function createProgramAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/businesses/${businessId}/programs`, {
      method: "POST",
      body: {
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "") || undefined,
        requiredStamps: Number(formData.get("requiredStamps")),
        minMinutesBetweenStamps: Number(formData.get("minMinutesBetweenStamps") ?? 5),
      },
    });
  } catch (error) {
    return { error: messageFrom(error, "Could not create the program.") };
  }

  revalidatePath(`/b/${businessId}/programs`);
  return {};
}

export async function createRewardAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/businesses/${businessId}/rewards`, {
      method: "POST",
      body: {
        programId: String(formData.get("programId") ?? ""),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "") || undefined,
        type: String(formData.get("type") ?? "FREE_ITEM"),
        requiredStamps: Number(formData.get("requiredStamps")),
      },
    });
  } catch (error) {
    return { error: messageFrom(error, "Could not create the reward.") };
  }

  revalidatePath(`/b/${businessId}/rewards`);
  return {};
}

export async function activateDeviceAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/businesses/${businessId}/devices/activate`, {
      method: "POST",
      body: {
        deviceIdentifier: String(formData.get("deviceIdentifier") ?? "").trim().toUpperCase(),
        activationCode: String(formData.get("activationCode") ?? "").trim().toUpperCase(),
        branchId: String(formData.get("branchId") ?? ""),
      },
    });
  } catch (error) {
    return { error: messageFrom(error, "Could not activate the stamper.") };
  }

  revalidatePath(`/b/${businessId}/devices`);
  return {};
}

export async function revokeDeviceAction(businessId: string, deviceId: string): Promise<void> {
  await apiFetch(`/businesses/${businessId}/devices/${deviceId}/revoke`, {
    method: "POST",
    body: { reason: "Revoked from dashboard" },
  });
  revalidatePath(`/b/${businessId}/devices`);
}

interface RedeemState {
  error?: string;
  success?: string;
}

export async function validateRedemptionAction(
  businessId: string,
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  const code = String(formData.get("redemptionCode") ?? "").trim().toUpperCase();

  try {
    const redemption = await apiFetch<{ rewardId: { name: string } }>(
      `/businesses/${businessId}/redemptions/validate`,
      { method: "POST", body: { redemptionCode: code } },
    );
    return { success: `Redeemed: ${redemption.rewardId?.name ?? "reward"}` };
  } catch (error) {
    return { error: messageFrom(error, "Could not validate this code.") };
  }
}

export async function inviteMemberAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/businesses/${businessId}/members`, {
      method: "POST",
      body: {
        email: String(formData.get("email") ?? ""),
        role: String(formData.get("role") ?? "STAFF"),
      },
    });
  } catch (error) {
    return { error: messageFrom(error, "Could not invite this person.") };
  }

  revalidatePath(`/b/${businessId}/staff`);
  return {};
}
