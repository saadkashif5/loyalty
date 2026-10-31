import { apiFetch } from "@/lib/api";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

interface Stamp {
  _id: string;
  source: string;
  createdAt: string;
  customerId?: { name: string; email: string } | null;
}

interface RedemptionRecord {
  _id: string;
  redemptionCode: string;
  status: string;
  createdAt: string;
  rewardId?: { name: string } | null;
  customerId?: { name: string } | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const [stamps, redemptions] = await Promise.all([
    apiFetch<Stamp[]>(`/businesses/${businessId}/stamps?limit=25`),
    apiFetch<RedemptionRecord[]>(`/businesses/${businessId}/redemptions?limit=25`),
  ]);

  return (
    <>
      <PageHeader title="Activity" description="Recent stamps and reward redemptions." />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent stamps</h2>
          {stamps.length === 0 ? (
            <EmptyState>No stamps yet.</EmptyState>
          ) : (
            <Card className="divide-y divide-slate-100 p-0">
              {stamps.map((stamp) => (
                <div key={stamp._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {stamp.customerId?.name ?? "Unknown customer"}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(stamp.createdAt)}</p>
                  </div>
                  <span className="text-xs text-slate-500">{stamp.source}</span>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Reward redemptions</h2>
          {redemptions.length === 0 ? (
            <EmptyState>No redemptions yet.</EmptyState>
          ) : (
            <Card className="divide-y divide-slate-100 p-0">
              {redemptions.map((record) => (
                <div key={record._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{record.rewardId?.name ?? "Reward"}</p>
                    <p className="text-xs text-slate-500">
                      {record.customerId?.name ?? "Customer"} · {formatDate(record.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
