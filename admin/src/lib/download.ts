import { NextResponse } from "next/server";
import { API_BASE_URL } from "./api";
import { getAccessToken } from "./session";
import { clientHeaders } from "./forwarding";

/**
 * Passes a file from the API (invoice PDF, receipt, CSV) to the browser.
 * The access token stays on the server; the API still checks permissions.
 */
export async function proxyDownload(path: string): Promise<Response> {
  const token = await getAccessToken();
  // The proxy already sends signed-out visitors to /login; this is a backstop.
  if (!token) return new NextResponse("Sign in again", { status: 401 });

  const upstream = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...(await clientHeaders()) },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Not available", { status: upstream.status === 404 ? 404 : 403 });
  }

  const headers = new Headers();
  for (const name of ["content-type", "content-disposition", "content-security-policy"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "private, no-store");
  return new Response(upstream.body, { status: 200, headers });
}
