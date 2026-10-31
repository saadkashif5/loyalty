import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { can, requirePermission } from "@/lib/me";
import { Card, EmptyState, PageHeader, StatusBadge, formatDate, formatPkr } from "@/components/ui";
import { ApproveForm, RejectForm } from "./RejectForm";

interface Proof {
  _id: string;
  status: string;
  method: string;
  amountPkr: number;
  reference?: string;
  note?: string;
  mimeType: string;
  createdAt: string;
  rejectionReason?: string;
  businessId: { _id: string; name: string } | null;
  invoiceId: { _id: string; number: string; totalPkr: number; status: string } | null;
  uploadedBy: { name: string; email: string } | null;
}

/** Receipts owners uploaded: check each against the bank statement, then approve or reject. */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await requirePermission(PLATFORM_PERMISSIONS.BILLING_VIEW);
  const canReview = can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const { status } = await searchParams;
  const showing = status === "ALL" ? "ALL" : "PENDING";
  const proofs = await apiFetch<Proof[]>(`/admin/payment-proofs?status=${showing}`);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payment receipts"
        description="Match each receipt to the bank statement before approving. Approving records the payment and switches the business back on if it was suspended."
        action={
          <Link
            href={showing === "PENDING" ? "/payments?status=ALL" : "/payments"}
            className="text-sm text-brand-600 hover:underline"
          >
            {showing === "PENDING" ? "Show all" : "Waiting only"}
          </Link>
        }
      />

      {proofs.length === 0 ? (
        <EmptyState>No receipts waiting.</EmptyState>
      ) : (
        proofs.map((proof) => {
          const mismatch = proof.invoiceId && proof.amountPkr < proof.invoiceId.totalPkr;
          return (
            <Card key={proof._id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {proof.businessId ? (
                      <Link
                        href={`/businesses/${proof.businessId._id}`}
                        className="hover:underline"
                      >
                        {proof.businessId.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </p>
                  <p className="text-sm text-slate-600">
                    Invoice {proof.invoiceId?.number} for {formatPkr(proof.invoiceId?.totalPkr)} ·
                    claims {formatPkr(proof.amountPkr)} by{" "}
                    {proof.method.replace("_", " ").toLowerCase()}
                    {proof.reference ? ` · ref ${proof.reference}` : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    Uploaded by {proof.uploadedBy?.name} ({proof.uploadedBy?.email}) ·{" "}
                    {formatDate(proof.createdAt)}
                  </p>
                  {proof.note ? <p className="mt-1 text-sm">“{proof.note}”</p> : null}
                  {mismatch ? (
                    <p className="mt-1 text-sm text-amber-700">
                      The amount claimed is less than the invoice; approval will be refused.
                    </p>
                  ) : null}
                  {proof.rejectionReason ? (
                    <p className="mt-1 text-sm text-red-700">Rejected: {proof.rejectionReason}</p>
                  ) : null}
                </div>
                <StatusBadge status={proof.status} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`/files/proofs/${proof._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 hover:underline"
                >
                  Open receipt ({proof.mimeType === "application/pdf" ? "PDF" : "image"})
                </a>
                {canReview && proof.status === "PENDING" ? (
                  <>
                    <ApproveForm proofId={proof._id} />
                    <RejectForm proofId={proof._id} />
                  </>
                ) : null}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
