import { proxyDownload } from "@/lib/download";

const ID = /^[a-f0-9]{24}$/;

/** A finished export, streamed from the API so the token never reaches the browser. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const { exportId } = await params;
  if (!ID.test(exportId)) return new Response("Not found", { status: 404 });
  return proxyDownload(`/admin/exports/${exportId}/file`);
}
