"use server";

import { redirect } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { clearSessionCookies, getRefreshToken, setSessionCookies } from "@/lib/session";

interface FormState {
  error?: string;
}

async function postAuth(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  return { ok: response.ok, payload };
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { ok, payload } = await postAuth("/auth/login", { email, password });

  if (!ok || !payload?.success) {
    return { error: payload?.error?.message ?? "Could not sign in. Please try again." };
  }

  await setSessionCookies(payload.data);
  redirect("/businesses");
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { ok, payload } = await postAuth("/auth/register", { name, email, password });

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
