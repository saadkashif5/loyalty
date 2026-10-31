"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { API_BASE_URL, ApiRequestError, apiFetch } from "@/lib/api";
import { clientHeaders } from "@/lib/forwarding";
import {
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
} from "@/lib/session";

export interface LoginState {
  error?: string;
  /** Set after the password step when the account uses two-step verification. */
  mfaToken?: string;
}

async function postAuth(path: string, body: Record<string, unknown>, token?: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await clientHeaders()),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  return { ok: response.ok, payload };
}

/** Only same-site paths, so a crafted link cannot bounce people to another site after sign-in. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/businesses";
}

/** Both sign-in steps: password first, then the authenticator code if the account needs one. */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const next = safeNext(formData.get("next"));
  const mfaToken = String(formData.get("mfaToken") ?? "");

  if (mfaToken) {
    const code = String(formData.get("code") ?? "").replace(/\s/g, "");
    const recoveryCode = String(formData.get("recoveryCode") ?? "").trim();
    const { ok, payload } = await postAuth(
      "/auth/login/mfa",
      recoveryCode ? { mfaToken, recoveryCode } : { mfaToken, code },
    );

    if (!ok || !payload?.success) {
      return { mfaToken, error: payload?.error?.message ?? "That code did not work." };
    }
    await setSessionCookies(payload.data);
    redirect(next);
  }

  const { ok, payload } = await postAuth("/auth/login", {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!ok || !payload?.success) {
    return { error: payload?.error?.message ?? "Could not sign in. Please try again." };
  }
  if (payload.data.mfaRequired) {
    return { mfaToken: payload.data.mfaToken };
  }

  await setSessionCookies(payload.data);
  redirect(next);
}

export async function registerAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { ok, payload } = await postAuth("/auth/register", {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!ok || !payload?.success) {
    return { error: payload?.error?.message ?? "Could not create your account." };
  }

  await setSessionCookies(payload.data);
  redirect("/businesses");
}

export async function logoutAction() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await postAuth("/auth/logout", { refreshToken });
  }
  await clearSessionCookies();
  redirect("/login");
}

// ---- Owner invitation -------------------------------------------------------

export async function acceptInvitationAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (formData.has("password") && password !== confirm) {
    return { error: "The two passwords do not match." };
  }

  const body: Record<string, unknown> = {};
  if (password) body.password = password;
  const name = String(formData.get("name") ?? "").trim();
  if (name) body.name = name;

  const { ok, payload } = await postAuth(
    `/invitations/${encodeURIComponent(token)}/accept`,
    body,
    await getAccessToken(),
  );
  if (!ok || !payload?.success) {
    return { error: payload?.error?.message ?? "Could not accept the invitation." };
  }

  // A new account comes back signed in; an existing one already was.
  if (payload.data.accessToken) await setSessionCookies(payload.data);
  redirect(payload.data.mfaSetupRequired ? "/account/security?welcome=1" : "/businesses");
}

// ---- Two-step verification and sessions --------------------------------------

export interface MfaSetupState {
  error?: string;
  secret?: string;
  qrDataUrl?: string;
  recoveryCodes?: string[];
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
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
    revalidatePath("/account/security");
    return { recoveryCodes: result.recoveryCodes };
  } catch (error) {
    return { ...prev, error: messageFrom(error, "That code did not work.") };
  }
}

export async function revokeSessionAction(sessionId: string): Promise<void> {
  await apiFetch(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  revalidatePath("/account/security");
}

export async function revokeOtherSessionsAction(): Promise<void> {
  await apiFetch("/auth/sessions/revoke-others", { method: "POST" });
  revalidatePath("/account/security");
}
