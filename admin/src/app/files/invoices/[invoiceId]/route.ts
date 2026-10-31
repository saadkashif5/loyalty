import { proxyDownload } from "@/lib/download";

export async function GET(_req: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return proxyDownload(`/admin/invoices/${encodeURIComponent(invoiceId)}/pdf`);
}
