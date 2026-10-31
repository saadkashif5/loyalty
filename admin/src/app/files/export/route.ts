import type { NextRequest } from "next/server";
import { proxyDownload } from "@/lib/download";

export async function GET(req: NextRequest) {
  const query = new URLSearchParams();
  for (const key of ["from", "to"]) {
    const value = req.nextUrl.searchParams.get(key);
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) query.set(key, value);
  }
  return proxyDownload(`/admin/billing/export.csv?${query.toString()}`);
}
