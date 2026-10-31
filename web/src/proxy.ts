import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/cookies";
import { clientHeadersFrom } from "@/lib/forwarding";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

function toLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}

// Keeps signed-out visitors off dashboard routes, and silently renews the
// 15-minute access token from the refresh token so people are not signed out
// mid-shift. The API still authorises every request on its own.
export async function proxy(request: NextRequest) {
  if (request.cookies.has(ACCESS_TOKEN_COOKIE)) return NextResponse.next();

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

export const config = {
  matcher: ["/businesses/:path*", "/b/:path*", "/account/:path*"],
};
