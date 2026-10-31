import { cookies } from "next/headers";
import {
  ACCESS_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE,
  TAP_COOKIE,
  TAP_COOKIE_OPTIONS,
} from "./cookies";

export async function setSessionCookies(tokens: { accessToken: string; refreshToken: string }) {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, ACCESS_COOKIE_OPTIONS);
  store.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value;
}

export interface PendingTap {
  tapToken: string;
  businessId: string;
  programIds: string[];
}

export function encodeTap(tap: PendingTap): string {
  return Buffer.from(JSON.stringify(tap)).toString("base64url");
}

/** The tap waiting for sign-in or joining, if any. The API still validates the token. */
export async function getPendingTap(): Promise<PendingTap | null> {
  const raw = (await cookies()).get(TAP_COOKIE)?.value;
  if (!raw) return null;
  try {
    const tap = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as PendingTap;
    return typeof tap.tapToken === "string" && typeof tap.businessId === "string" ? tap : null;
  } catch {
    return null;
  }
}

export async function clearPendingTap() {
  (await cookies()).delete(TAP_COOKIE);
}

export { TAP_COOKIE, TAP_COOKIE_OPTIONS };
