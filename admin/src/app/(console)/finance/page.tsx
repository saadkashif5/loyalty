import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { can, requirePermission } from "@/lib/me";
import { RemindButton } from "./RemindButton";
import { ExportForm } from "./ExportForm";
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
  mrrByPlan: Array<{ plan: string; businesses: number; mrrPkr: number }>;
  mrrByCity: Array<{ city: string; businesses: number; mrrPkr: number }>;
  churnPercent: number | null;
  trialConversionPercent: number | null;
  trialsEnded: number;
  overdue: Array<{
    subscriptionId: string;
    business: { _id: string; name: string } | null;
    status: string;
    plan: string;
    amountDuePkr: number;
    dueSince: string | null;
    graceEndsAt: string | null;
    suspendedAt: string | null;
    lastManualReminderAt: string | null;
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
  const me = await requirePermission(PLATFORM_PERMISSIONS.BILLING_VIEW);
  const canRemind = can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const [data, exports] = await Promise.all([
    apiFetch<Overview>("/admin/billing/overview"),
    apiFetch<
      Array<{ _id: string; status: string; fileName?: string; rows?: number; createdAt: string }>
    >("/admin/exports"),
  ]);

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat
          label="Churn, last 30 days"
          value={data.churnPercent === null ? "—" : `${data.churnPercent}%`}
        />
        <Stat
          label={`Trial conversion, last 90 days (${data.trialsEnded} ended)`}
          value={data.trialConversionPercent === null ? "—" : `${data.trialConversionPercent}%`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Stat label="On trial" value={data.counts.TRIALING} />
        <Stat label="Paying" value={data.counts.ACTIVE} />
        <Stat label="Past due" value={data.counts.PAST_DUE} />
        <Stat label="Suspended (unpaid)" value={data.counts.SUSPENDED} />
        <Stat label="Cancelled" value={data.counts.CANCELLED} />
      </div>

      {data.mrrByPlan.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Revenue by plan</h2>
          <ul className="divide-y divide-ink-100 text-sm">
            {data.mrrByPlan.map((row) => (
              <li key={row.plan} className="flex flex-wrap justify-between gap-3 py-2">
                <span>
                  {row.plan} · {row.businesses} paying
                </span>
                <span className="text-ink-500">{formatPkr(row.mrrPkr)} / month</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {data.mrrByCity.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Revenue by city</h2>
          <ul className="divide-y divide-ink-100 text-sm">
            {data.mrrByCity.map((row) => (
              <li key={row.city} className="flex flex-wrap justify-between gap-3 py-2">
                <span>
                  {row.city} · {row.businesses} paying
                </span>
                <span className="text-ink-500">{formatPkr(row.mrrPkr)} / month</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 font-semibold">Export invoices for the accountant</h2>
        <ExportForm />
        <p className="mt-2 text-xs text-ink-500">
          Leave blank for this month so far. Files are kept for a week.
        </p>
        {exports.length > 0 ? (
          <ul className="mt-3 divide-y divide-ink-100 text-sm">
            {exports.map((e) => (
              <li key={e._id} className="flex flex-wrap justify-between gap-3 py-2">
                <span>
                  {e.fileName ?? "Invoices"} · {formatDate(e.createdAt)}
                </span>
                {e.status === "DONE" ? (
                  <a
                    href={`/files/exports/${e._id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    Download ({e.rows} rows)
                  </a>
                ) : (
                  <span className="text-ink-500">
                    {e.status === "FAILED" ? "Failed" : "Preparing…"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <section>
        <h2 className="mb-3 font-semibold">Overdue</h2>
        {data.overdue.length === 0 ? (
          <EmptyState>Nobody is overdue.</EmptyState>
        ) : (
          <Table
            head={[
              "Business",
              "Status",
              "Plan",
              "Due",
              "Since",
              "Suspends / suspended",
              canRemind ? "Remind" : "",
            ]}
          >
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
                <Td>
                  {canRemind && row.business ? (
                    <RemindButton
                      businessId={row.business._id}
                      lastSentAt={row.lastManualReminderAt}
                    />
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <Card>
        <h2 className="mb-3 font-semibold">Recent payments</h2>
        {data.recentPayments.length === 0 ? (
          <p className="text-sm text-ink-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100 text-sm">
            {data.recentPayments.map((p) => (
              <li key={p._id} className="flex flex-wrap justify-between gap-3 py-2">
                <span>
                  {p.businessId?.name ?? "—"} · {p.method.replace("_", " ").toLowerCase()}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="text-ink-500">
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
