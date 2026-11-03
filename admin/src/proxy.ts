import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/cookies";
import { clientHeadersFrom } from "@/lib/forwarding";
import { applyContentSecurityPolicy } from "@/lib/security";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

// Reachable signed out: signing in, and getting back in after a forgotten password.
const PUBLIC = /^\/(login|forgot-password|reset-password)(\/|$)/;

// Files keep their own headers: receipts are served with a stricter sandbox.
const isFile = (pathname: string) => pathname.startsWith("/files/");
function toLogin(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}

// Keeps signed-out visitors on the login page, and silently renews the
// 15-minute access token from the refresh token so the team is not signed out
// mid-task. The API still authorises every request on its own.
async function renewSession(request: NextRequest) {
  if (request.cookies.has(ACCESS_TOKEN_COOKIE))
    return NextResponse.next({ request: { headers: request.headers } });

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return toLogin(request);

  const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...clientHeadersFrom(request.headers) },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  }).catch(() => null);

  const payload = refreshed?.ok ? await refreshed.json().catch(() => null) : null;
  if (!payload?.success) return toLogin(request);

  const { accessToken, refreshToken: nextRefreshToken } = payload.data as {
    accessToken: string;
    refreshToken: string;
  };

  // The page being rendered must see the new token, and so must the browser.
  request.cookies.set(ACCESS_TOKEN_COOKIE, accessToken);
  request.cookies.set(REFRESH_TOKEN_COOKIE, nextRefreshToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
  response.cookies.set(REFRESH_TOKEN_COOKIE, nextRefreshToken, REFRESH_COOKIE_OPTIONS);
  return response;
}

export async function proxy(request: NextRequest) {
  const policy = applyContentSecurityPolicy(request.headers);
  const response = PUBLIC.test(request.nextUrl.pathname)
    ? NextResponse.next({ request: { headers: request.headers } })
    : await renewSession(request);
  if (!isFile(request.nextUrl.pathname)) {
    response.headers.set("Content-Security-Policy", policy);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
