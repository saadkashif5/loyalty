import { proxyDownload } from "@/lib/download";

export async function GET(_req: Request, { params }: { params: Promise<{ proofId: string }> }) {
  const { proofId } = await params;
  return proxyDownload(`/admin/payment-proofs/${encodeURIComponent(proofId)}/file`);
}
