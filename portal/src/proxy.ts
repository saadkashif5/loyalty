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
const PRIVATE_PREFIXES = ["/cards", "/rewards", "/profile", "/notifications"];

function isPrivate(pathname: string) {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function toSignIn(request: NextRequest) {
  const url = new URL("/signin", request.url);
  url.searchParams.set("next", request.nextUrl.pathname);
  const response = NextResponse.redirect(url);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}

// Renews the 15-minute access token from the refresh token, so a customer
// who tapped yesterday is still signed in today. Public pages (the tap link,
// joining, sign-in) stay open to signed-out visitors.
async function renewSession(request: NextRequest) {
  if (request.cookies.has(ACCESS_TOKEN_COOKIE))
    return NextResponse.next({ request: { headers: request.headers } });

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return isPrivate(request.nextUrl.pathname)
      ? toSignIn(request)
      : NextResponse.next({ request: { headers: request.headers } });
  }

  const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...clientHeadersFrom(request.headers) },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  }).catch(() => null);

  const payload = refreshed?.ok ? await refreshed.json().catch(() => null) : null;
  if (!payload?.success) {
    if (isPrivate(request.nextUrl.pathname)) return toSignIn(request);
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }

  const { accessToken, refreshToken: nextRefreshToken } = payload.data as {
    accessToken: string;
    refreshToken: string;
  };

  request.cookies.set(ACCESS_TOKEN_COOKIE, accessToken);
  request.cookies.set(REFRESH_TOKEN_COOKIE, nextRefreshToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
  response.cookies.set(REFRESH_TOKEN_COOKIE, nextRefreshToken, REFRESH_COOKIE_OPTIONS);
  return response;
}

export async function proxy(request: NextRequest) {
  const policy = applyContentSecurityPolicy(request.headers);
  const response = await renewSession(request);
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
