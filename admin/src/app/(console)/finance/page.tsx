import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { requirePermission } from "@/lib/me";
import {
  Card,
  EmptyState,
  PageHeader,
  Stat,
  StatusBadge,
  Table,
  Td,
  formatDate,
  formatPkr,
} from "@/components/ui";

interface Overview {
  counts: Record<"TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED", number>;
  mrrPkr: number;
  arrPkr: number;
  collectedThisMonthPkr: number;
  overdue: Array<{
    subscriptionId: string;
    business: { _id: string; name: string } | null;
    status: string;
    plan: string;
    amountDuePkr: number;
    dueSince: string | null;
    graceEndsAt: string | null;
    suspendedAt: string | null;
  }>;
  recentPayments: Array<{
    _id: string;
    amountPkr: number;
    method: string;
    reference?: string;
    createdAt: string;
    businessId: { _id: string; name: string } | null;
  }>;
}

export default async function FinancePage() {
  await requirePermission(PLATFORM_PERMISSIONS.BILLING_VIEW);
  const data = await apiFetch<Overview>("/admin/billing/overview");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance"
        description="Recurring revenue and collections. Amounts exclude tax."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Monthly recurring revenue" value={formatPkr(data.mrrPkr)} />
        <Stat label="Annual run rate" value={formatPkr(data.arrPkr)} />
        <Stat label="Collected this month" value={formatPkr(data.collectedThisMonthPkr)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Stat label="On trial" value={data.counts.TRIALING} />
        <Stat label="Paying" value={data.counts.ACTIVE} />
        <Stat label="Past due" value={data.counts.PAST_DUE} />
        <Stat label="Suspended (unpaid)" value={data.counts.SUSPENDED} />
        <Stat label="Cancelled" value={data.counts.CANCELLED} />
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Export invoices for the accountant</h2>
        <form action="/files/export" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-slate-600">From</span>
            <input
              type="date"
              name="from"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-600">To</span>
            <input type="date" name="to" className="rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <button className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50">
            Download CSV
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Leave blank for this month so far.</p>
      </Card>

      <section>
        <h2 className="mb-3 font-semibold">Overdue</h2>
        {data.overdue.length === 0 ? (
          <EmptyState>Nobody is overdue.</EmptyState>
        ) : (
          <Table head={["Business", "Status", "Plan", "Due", "Since", "Suspends / suspended"]}>
            {data.overdue.map((row) => (
              <tr key={row.subscriptionId}>
                <Td>
                  {row.business ? (
                    <Link
                      href={`/businesses/${row.business._id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {row.business.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
                <Td>{row.plan}</Td>
                <Td>{formatPkr(row.amountDuePkr)}</Td>
                <Td>{formatDate(row.dueSince)}</Td>
                <Td>{formatDate(row.suspendedAt ?? row.graceEndsAt)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <Card>
        <h2 className="mb-3 font-semibold">Recent payments</h2>
        {data.recentPayments.length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.recentPayments.map((p) => (
              <li key={p._id} className="flex flex-wrap justify-between gap-3 py-2">
                <span>
                  {p.businessId?.name ?? "—"} · {p.method.replace("_", " ").toLowerCase()}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="text-slate-500">
                  {formatPkr(p.amountPkr)} · {formatDate(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
