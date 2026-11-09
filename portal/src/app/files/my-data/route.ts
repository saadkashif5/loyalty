import { API_BASE_URL } from "@/lib/api";
import { clientHeaders } from "@/lib/forwarding";
import { getAccessToken } from "@/lib/session";

/** The customer's own data as a JSON download, fetched with their session. */
export async function GET() {
  const token = await getAccessToken();
  if (!token) return new Response("Sign in again", { status: 401 });

  const upstream = await fetch(`${API_BASE_URL}/users/me/export`, {
    headers: { Authorization: `Bearer ${token}`, ...(await clientHeaders()) },
    cache: "no-store",
  });
  if (!upstream.ok) {
    return new Response(upstream.status === 429 ? "Try again later" : "Not available", {
      status: upstream.status === 429 ? 429 : 502,
    });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="taptapsell-my-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
