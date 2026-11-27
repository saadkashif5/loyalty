import { apiFetch } from "@/lib/api";
import { decideStampRequestAction } from "@/app/actions/business";
import { Button, Card, EmptyState, PageHeader, SecondaryButton, formatDate } from "@/components/ui";

interface StampRequest {
  _id: string;
  customerId: { name: string } | null;
  requestedBy: { name: string } | null;
  branchId: { name: string } | null;
  createdAt: string;
}

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const waiting = await apiFetch<StampRequest[]>(`/businesses/${businessId}/stamp-requests`);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Counter stamps a staff member added after the day's approval limit. Approve to give the customer the stamp."
      />
      {waiting.length === 0 ? (
        <EmptyState>Nothing waiting. Set the limit under Settings.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {waiting.map((r) => (
            <li key={r._id}>
              <Card className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm">
                  <p className="font-medium">{r.customerId?.name ?? "Customer"}</p>
                  <p className="text-ink-500">
                    Added by {r.requestedBy?.name ?? "staff"}
                    {r.branchId ? ` at ${r.branchId.name}` : ""} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={decideStampRequestAction.bind(null, businessId, r._id, true)}>
                    <Button type="submit">Approve</Button>
                  </form>
                  <form action={decideStampRequestAction.bind(null, businessId, r._id, false)}>
                    <SecondaryButton type="submit">Turn down</SecondaryButton>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
