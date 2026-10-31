import { cookies } from "next/headers";
import {
  ACCESS_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE,
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
