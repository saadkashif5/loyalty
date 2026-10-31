"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { API_BASE_URL, ApiRequestError, apiFetch } from "@/lib/api";
import { clientHeaders } from "@/lib/forwarding";
import { clearSessionCookies, getRefreshToken, setSessionCookies } from "@/lib/session";

export interface FormState {
  error?: string;
  done?: boolean;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

function text(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? "").trim();
  return value || undefined;
}

// ---- Sign-in --------------------------------------------------------------------

export interface LoginState extends FormState {
  mfaToken?: string;
}

async function postAuth(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await clientHeaders()) },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, payload };
}

interface SignedIn {
  accessToken: string;
  refreshToken: string;
  user: { platformRole: string | null };
}

/** Only team members get a console session; anyone else is signed straight back out. */
async function startSession(data: SignedIn): Promise<LoginState> {
  if (!data.user.platformRole) {
    await postAuth("/auth/logout", { refreshToken: data.refreshToken });
    return { error: "This account is not on the TapTapSell team." };
  }
  await setSessionCookies(data);
  redirect("/");
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const mfaToken = String(formData.get("mfaToken") ?? "");

  if (mfaToken) {
    const recoveryCode = text(formData, "recoveryCode");
    const code = String(formData.get("code") ?? "").replace(/\s/g, "");
    const { ok, payload } = await postAuth(
      "/auth/login/mfa",
      recoveryCode ? { mfaToken, recoveryCode } : { mfaToken, code },
    );
    if (!ok || !payload?.success) {
      return { mfaToken, error: payload?.error?.message ?? "That code did not work." };
    }
    return startSession(payload.data);
  }

  const { ok, payload } = await postAuth("/auth/login", {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!ok || !payload?.success) {
    return { error: payload?.error?.message ?? "Could not sign in. Please try again." };
  }
  if (payload.data.mfaRequired) return { mfaToken: payload.data.mfaToken };
  return startSession(payload.data);
}

export async function logoutAction() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) await postAuth("/auth/logout", { refreshToken });
  await clearSessionCookies();
  redirect("/login");
}

// ---- Own security -----------------------------------------------------------------

export interface MfaSetupState extends FormState {
  secret?: string;
  qrDataUrl?: string;
  recoveryCodes?: string[];
}

/** Two steps on one form: start (new secret and QR code), then confirm with a code. */
export async function mfaSetupAction(
  prev: MfaSetupState,
  formData: FormData,
): Promise<MfaSetupState> {
  if (!formData.has("code")) {
    try {
      const setup = await apiFetch<{ secret: string; otpauthUri: string }>("/auth/mfa/setup", {
        method: "POST",
      });
      const qrDataUrl = await QRCode.toDataURL(setup.otpauthUri, { margin: 1, width: 220 });
      return { secret: setup.secret, qrDataUrl };
    } catch (error) {
      return { error: messageFrom(error, "Could not start setup. Please try again.") };
    }
  }

  try {
    const result = await apiFetch<{ recoveryCodes: string[] }>("/auth/mfa/enable", {
      method: "POST",
      body: { code: String(formData.get("code") ?? "").replace(/\s/g, "") },
    });
    revalidatePath("/security");
    return { recoveryCodes: result.recoveryCodes };
  } catch (error) {
    return { ...prev, error: messageFrom(error, "That code did not work.") };
  }
}

export async function revokeSessionAction(sessionId: string): Promise<void> {
  await apiFetch(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  revalidatePath("/security");
}

export async function revokeOtherSessionsAction(): Promise<void> {
  await apiFetch("/auth/sessions/revoke-others", { method: "POST" });
  revalidatePath("/security");
}

// ---- Businesses and invitations ------------------------------------------------------

export interface InviteState extends FormState {
  inviteUrl?: string;
  businessId?: string;
}

export async function inviteBusinessAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const phone = text(formData, "businessPhone");
  const address = text(formData, "address");

  try {
    const result = await apiFetch<{ business: { _id: string }; inviteUrl: string }>(
      "/admin/businesses",
      {
        method: "POST",
        body: {
          business: {
            name: text(formData, "businessName"),
            category: text(formData, "category") ?? "OTHER",
            description: text(formData, "description"),
            ...(phone || address ? { contact: { phone, address } } : {}),
          },
          owner: {
            name: text(formData, "ownerName"),
            email: text(formData, "ownerEmail"),
            phone: text(formData, "ownerPhone"),
          },
          leadId: text(formData, "leadId"),
          planCode: text(formData, "planCode"),
          trialDays: formData.has("trialDays") ? Number(formData.get("trialDays")) : undefined,
        },
      },
    );
    revalidatePath("/businesses");
    revalidatePath("/leads");
    return { done: true, inviteUrl: result.inviteUrl, businessId: result.business._id };
  } catch (error) {
    return { error: messageFrom(error, "Could not create the business.") };
  }
}

export async function setBusinessStatusAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/admin/businesses/${businessId}/status`, {
      method: "PATCH",
      body: { status: text(formData, "status"), reason: text(formData, "reason") },
    });
    revalidatePath(`/businesses/${businessId}`);
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not change the status.") };
  }
}

export async function resendInvitationAction(
  invitationId: string,
  businessId: string,
  _prev: InviteState,
): Promise<InviteState> {
  try {
    const result = await apiFetch<{ inviteUrl: string }>(
      `/admin/invitations/${invitationId}/resend`,
      { method: "POST" },
    );
    revalidatePath(`/businesses/${businessId}`);
    return { done: true, inviteUrl: result.inviteUrl };
  } catch (error) {
    return { error: messageFrom(error, "Could not create a new link.") };
  }
}

export async function revokeInvitationAction(
  invitationId: string,
  businessId: string,
): Promise<void> {
  await apiFetch(`/admin/invitations/${invitationId}/revoke`, { method: "POST" });
  revalidatePath(`/businesses/${businessId}`);
}

export async function assignDeviceAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const deviceId = text(formData, "deviceId");
  if (!deviceId) return { error: "Choose a stamper." };

  try {
    await apiFetch(`/admin/devices/${deviceId}/assign`, {
      method: "PATCH",
      body: { businessId, branchId: text(formData, "branchId") },
    });
    revalidatePath(`/businesses/${businessId}`);
    revalidatePath("/devices");
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not assign the stamper.") };
  }
}

// ---- Stamper fleet ------------------------------------------------------------------

export interface MintState extends FormState {
  devices?: Array<{ deviceIdentifier: string; activationCode: string }>;
}

export async function mintDevicesAction(_prev: MintState, formData: FormData): Promise<MintState> {
  try {
    const devices = await apiFetch<Array<{ deviceIdentifier: string; activationCode: string }>>(
      "/admin/devices",
      {
        method: "POST",
        body: {
          quantity: Number(formData.get("quantity") ?? 1),
          tagType: text(formData, "tagType") ?? "NTAG21X_MIRROR",
        },
      },
    );
    revalidatePath("/devices");
    return {
      done: true,
      devices: devices.map((d) => ({
        deviceIdentifier: d.deviceIdentifier,
        activationCode: d.activationCode,
      })),
    };
  } catch (error) {
    return { error: messageFrom(error, "Could not create stampers.") };
  }
}

// ---- Leads ----------------------------------------------------------------------------

export async function updateLeadAction(
  leadId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/admin/leads/${leadId}`, {
      method: "PATCH",
      body: { status: text(formData, "status"), note: text(formData, "note") },
    });
    revalidatePath("/leads");
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not update the lead.") };
  }
}

// ---- Users ---------------------------------------------------------------------------

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED") {
  await apiFetch(`/admin/customers/${userId}/status`, { method: "PATCH", body: { status } });
  revalidatePath("/users");
}

export async function signOutUserAction(userId: string) {
  await apiFetch(`/admin/users/${userId}/sign-out`, { method: "POST" });
  revalidatePath("/users");
}

// ---- Platform team -----------------------------------------------------------------------

export async function addTeamMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch("/admin/team", {
      method: "POST",
      body: { email: text(formData, "email"), platformRole: text(formData, "platformRole") },
    });
    revalidatePath("/team");
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not add this person.") };
  }
}

export async function updateTeamMemberAction(
  userId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const role = text(formData, "platformRole");
  try {
    await apiFetch(`/admin/team/${userId}`, {
      method: "PATCH",
      body: { platformRole: role === "REMOVE" ? null : role },
    });
    revalidatePath("/team");
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not change the role.") };
  }
}

// ---- Billing ---------------------------------------------------------------------------

function limitValue(formData: FormData, name: string): number | null {
  const value = text(formData, name);
  return value === undefined ? null : Number(value);
}

function planBody(formData: FormData) {
  return {
    name: text(formData, "name"),
    description: text(formData, "description"),
    priceMonthlyPkr: Number(formData.get("priceMonthlyPkr")),
    priceAnnualPkr: Number(formData.get("priceAnnualPkr")),
    limits: {
      branches: limitValue(formData, "branches"),
      programs: limitValue(formData, "programs"),
      stampers: limitValue(formData, "stampers"),
      staff: limitValue(formData, "staff"),
      customers: limitValue(formData, "customers"),
    },
    isPublic: formData.get("isPublic") === "on",
  };
}

export async function createPlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch("/admin/plans", {
      method: "POST",
      body: { code: text(formData, "code"), ...planBody(formData) },
    });
    revalidatePath("/plans");
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not create the plan.") };
  }
}

export async function updatePlanAction(
  planId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/admin/plans/${planId}`, {
      method: "PATCH",
      body: { ...planBody(formData), isActive: formData.get("isActive") === "on" },
    });
    revalidatePath("/plans");
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not save the plan.") };
  }
}

function refreshBilling(businessId: string) {
  revalidatePath(`/businesses/${businessId}`);
  revalidatePath("/finance");
}

export async function changeSubscriptionPlanAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/admin/businesses/${businessId}/subscription`, {
      method: "PATCH",
      body: { planCode: text(formData, "planCode"), billingCycle: text(formData, "billingCycle") },
    });
    refreshBilling(businessId);
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not change the plan.") };
  }
}

export async function extendTrialAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/admin/businesses/${businessId}/subscription/extend-trial`, {
      method: "POST",
      body: { days: Number(formData.get("days")) },
    });
    refreshBilling(businessId);
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not extend the trial.") };
  }
}

export async function recordPaymentAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/admin/businesses/${businessId}/payments`, {
      method: "POST",
      body: {
        amountPkr: Number(formData.get("amountPkr")),
        method: text(formData, "method"),
        reference: text(formData, "reference"),
        periods: Number(formData.get("periods") ?? 1),
        note: text(formData, "note"),
      },
    });
    refreshBilling(businessId);
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not record the payment.") };
  }
}

// ---- Invoices, receipts and billing settings -------------------------------------

export async function issueInvoiceAction(businessId: string): Promise<void> {
  await apiFetch(`/admin/businesses/${businessId}/invoices`, {
    method: "POST",
    body: { periods: 1 },
  });
  refreshBilling(businessId);
}

export async function voidInvoiceAction(
  businessId: string,
  invoiceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/admin/invoices/${invoiceId}/void`, {
      method: "POST",
      body: { reason: text(formData, "reason") },
    });
    refreshBilling(businessId);
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not void the invoice.") };
  }
}

export async function setDiscountAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/admin/businesses/${businessId}/subscription/discount`, {
      method: "PATCH",
      body: { discountPercent: Number(formData.get("discountPercent")) },
    });
    refreshBilling(businessId);
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not set the discount.") };
  }
}

export async function approveProofAction(proofId: string, _prev: FormState): Promise<FormState> {
  try {
    await apiFetch(`/admin/payment-proofs/${proofId}/approve`, { method: "POST" });
    revalidatePath("/payments");
    revalidatePath("/finance");
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not approve the receipt.") };
  }
}

export async function rejectProofAction(
  proofId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/admin/payment-proofs/${proofId}/reject`, {
      method: "POST",
      body: { reason: text(formData, "reason") },
    });
    revalidatePath("/payments");
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not reject the receipt.") };
  }
}

export async function saveBillingSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Up to three bank accounts; blank rows are ignored.
  const bankAccounts = [0, 1, 2]
    .map((i) => ({
      bankName: text(formData, `bankName${i}`),
      accountTitle: text(formData, `accountTitle${i}`),
      accountNumber: text(formData, `accountNumber${i}`),
      iban: text(formData, `iban${i}`),
    }))
    .filter((a) => a.bankName || a.accountTitle || a.accountNumber);

  try {
    await apiFetch("/admin/settings/billing", {
      method: "PUT",
      body: {
        companyName: text(formData, "companyName"),
        address: text(formData, "address"),
        ntn: text(formData, "ntn"),
        strn: text(formData, "strn"),
        email: text(formData, "email"),
        phone: text(formData, "phone"),
        taxLabel: text(formData, "taxLabel") ?? "Sales tax",
        taxRatePercent: Number(formData.get("taxRatePercent") ?? 0),
        invoicePrefix: text(formData, "invoicePrefix"),
        bankAccounts,
        raastId: text(formData, "raastId"),
        paymentInstructions: text(formData, "paymentInstructions"),
      },
    });
    revalidatePath("/billing-settings");
    return { done: true };
  } catch (error) {
    return { error: messageFrom(error, "Could not save the settings.") };
  }
}
