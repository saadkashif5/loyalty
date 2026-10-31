"use server";

import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { ApiRequestError, apiFetch, idempotencyKeyFor } from "@/lib/api";
import {
  clearPendingTap,
  clearSessionCookies,
  getPendingTap,
  getRefreshToken,
  setSessionCookies,
} from "@/lib/session";

/** Only same-site paths, so a crafted link cannot bounce people elsewhere after sign-in. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/cards";
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

// ---- Sign-in by email code ----------------------------------------------------------

export interface SignInState {
  step: "email" | "code" | "name" | "mfa";
  email?: string;
  challengeId?: string;
  /** Kept between the code and name steps; the API checks it again. */
  code?: string;
  mfaToken?: string;
  error?: string;
  notice?: string;
}

type VerifyResult =
  | { status: "NAME_REQUIRED" }
  | { status: "MFA_REQUIRED"; mfaToken: string }
  | { status: "SIGNED_IN"; accessToken: string; refreshToken: string };

async function requestCode(email: string): Promise<SignInState> {
  try {
    const { challengeId } = await apiFetch<{ challengeId: string }>("/auth/email-code", {
      method: "POST",
      body: { email },
      anonymous: true,
    });
    return { step: "code", email, challengeId, notice: `We sent a 6-digit code to ${email}.` };
  } catch (error) {
    return { step: "email", email, error: messageFrom(error, "Could not send the code.") };
  }
}

/** Every step of signing up or signing in, on one form. */
export async function signInAction(prev: SignInState, formData: FormData): Promise<SignInState> {
  const next = safeNext(formData.get("next"));
  const intent = String(formData.get("intent") ?? "");

  if (prev.step === "email" || intent === "resend") {
    const email = String(formData.get("email") ?? prev.email ?? "").trim();
    return requestCode(email);
  }

  if (prev.step === "mfa") {
    try {
      const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>(
        "/auth/login/mfa",
        {
          method: "POST",
          body: { mfaToken: prev.mfaToken, code: String(formData.get("code") ?? "").trim() },
          anonymous: true,
        },
      );
      await setSessionCookies(tokens);
    } catch (error) {
      return { ...prev, error: messageFrom(error, "That code did not work.") };
    }
    redirect(next);
  }

  const code = prev.step === "name" ? prev.code! : String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim() || undefined;

  let result: VerifyResult;
  try {
    result = await apiFetch<VerifyResult>("/auth/email-code/verify", {
      method: "POST",
      body: { challengeId: prev.challengeId, code, name },
      anonymous: true,
    });
  } catch (error) {
    return { ...prev, error: messageFrom(error, "That code did not work."), notice: undefined };
  }

  if (result.status === "NAME_REQUIRED") {
    return { ...prev, step: "name", code, error: undefined, notice: undefined };
  }
  if (result.status === "MFA_REQUIRED") {
    return { step: "mfa", mfaToken: result.mfaToken };
  }

  await setSessionCookies(result);
  redirect(next);
}

export async function signOutAction() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await apiFetch("/auth/logout", {
      method: "POST",
      body: { refreshToken },
      anonymous: true,
    }).catch(() => undefined);
  }
  await clearSessionCookies();
  redirect("/");
}

// ---- Joining and stamping -------------------------------------------------------------

/** Joining only: the customer taps again to collect stamps. */
export async function joinProgramAction(programId: string): Promise<void> {
  let cardId: string;
  try {
    const card = await apiFetch<{ _id: string }>("/loyalty-cards/join", {
      method: "POST",
      body: { programId },
    });
    cardId = card._id;
  } catch (error) {
    redirect(`/join?error=${encodeURIComponent(messageFrom(error, "Could not join."))}`);
  }
  await clearPendingTap();
  redirect(`/cards/${cardId}?result=joined`);
}

/** A member who had to sign in after tapping collects that tap's stamp. */
export async function collectStampAction(cardId: string): Promise<void> {
  const tap = await getPendingTap();
  if (!tap) redirect(`/cards/${cardId}?error=TAP_EXPIRED`);

  let target: string;
  try {
    const result = await apiFetch<{ unlockedRewards: unknown[] }>("/stamps", {
      method: "POST",
      body: { tapToken: tap.tapToken },
      idempotencyKey: idempotencyKeyFor(tap.tapToken),
    });
    target = `/cards/${cardId}?result=${result.unlockedRewards.length > 0 ? "unlocked" : "stamped"}`;
  } catch (error) {
    const reason = error instanceof ApiRequestError ? error.code : "UNKNOWN";
    target = `/cards/${cardId}?error=${encodeURIComponent(reason)}`;
  }
  await clearPendingTap();
  redirect(target);
}

// ---- Counter code --------------------------------------------------------------------

export interface CounterCodeResult {
  code?: string;
  qrDataUrl?: string;
  expiresAt?: string;
  error?: string;
}

/** The short code staff scan or type when the customer's phone cannot tap. */
export async function getCounterCodeAction(cardId: string): Promise<CounterCodeResult> {
  try {
    const { code, expiresAt } = await apiFetch<{ code: string; expiresAt: string }>(
      `/loyalty-cards/${encodeURIComponent(cardId)}/counter-code`,
      { method: "POST" },
    );
    const qrDataUrl = await QRCode.toDataURL(code, { margin: 1, width: 220 });
    return { code, qrDataUrl, expiresAt };
  } catch (error) {
    return { error: messageFrom(error, "Could not get a code. Please try again.") };
  }
}
