import { API_BASE_URL } from "@/lib/api";
import { clientHeaders } from "@/lib/forwarding";
import { getAccessToken } from "@/lib/session";

const ID = /^[a-f0-9]{24}$/;

/** A finished customer export, streamed so the access token never reaches the browser. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; exportId: string }> },
) {
  const { businessId, exportId } = await params;
  if (!ID.test(businessId) || !ID.test(exportId)) {
    return new Response("Not found", { status: 404 });
  }
  const token = await getAccessToken();
  if (!token) return new Response("Sign in again", { status: 401 });

  const upstream = await fetch(
    `${API_BASE_URL}/businesses/${businessId}/exports/${exportId}/file`,
    {
      headers: { Authorization: `Bearer ${token}`, ...(await clientHeaders()) },
      cache: "no-store",
    },
  );
  if (!upstream.ok || !upstream.body) {
    return new Response("Export not available", { status: upstream.status === 404 ? 404 : 502 });
  }
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const name of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { headers });
}
