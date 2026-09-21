import { cookies } from "next/headers";

export const ACCESS_TOKEN_COOKIE = "tts_access";
export const REFRESH_TOKEN_COOKIE = "tts_refresh";

// Tokens live in httpOnly cookies rather than localStorage so page scripts —
// and anything injected into them — cannot read them (§30, §31).
export function setSessionCookies(tokens: { accessToken: string; refreshToken: string }) {
  const store = cookies();
  const secure = process.env.NODE_ENV === "production";

  store.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 15,
  });

  store.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookies() {
  const store = cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}

export function getAccessToken(): string | undefined {
  return cookies().get(ACCESS_TOKEN_COOKIE)?.value;
}

export function getRefreshToken(): string | undefined {
  return cookies().get(REFRESH_TOKEN_COOKIE)?.value;
}
