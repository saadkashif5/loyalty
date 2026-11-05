import Link from "next/link";
import { getMembership } from "@/lib/membership";
import { requestCustomerExportAction } from "@/app/actions/business";
import { apiFetch, apiFetchPage } from "@/lib/api";
import {
  Card,
  EmptyState,
  Input,
  PageHeader,
  CursorPagination,
  SecondaryButton,
  formatDate,
} from "@/components/ui";

interface CustomerRow {
  cardId: string;
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  program: { name: string; requiredStamps: number } | null;
  stampCount: number;
  joinedAt: string;
  lastStampAt: string | null;
}

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const { businessId } = await params;
  const { q, cursor } = await searchParams;
  const { role } = await getMembership(businessId);
  // Exports are for owners and managers.
  const canExport = role === "OWNER" || role === "MANAGER";

  const query = new URLSearchParams({ limit: "25" });
  if (q) query.set("q", q);
  if (cursor) query.set("cursor", cursor);
  const [{ data, meta }, consents, exports] = await Promise.all([
    apiFetchPage<CustomerRow[]>(`/businesses/${businessId}/customers?${query.toString()}`),
    apiFetch<{ whatsapp: number }>(`/businesses/${businessId}/customers/consents`),
    canExport
      ? apiFetch<Array<{ _id: string; status: string; rows?: number; createdAt: string }>>(
          `/businesses/${businessId}/exports`,
        )
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone with a loyalty card here. Phone numbers are partly hidden to protect customers' privacy."
      />
      <p className="mb-4 text-sm text-slate-600">
        {consents.whatsapp} customer{consents.whatsapp === 1 ? " has" : "s have"} agreed to hear
        from you on WhatsApp. Customers choose this in their TapTapSell profile.
      </p>
      {canExport ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <form action={requestCustomerExportAction.bind(null, businessId)}>
            <SecondaryButton type="submit">Export customers (CSV)</SecondaryButton>
          </form>
          {exports.slice(0, 3).map((e) =>
            e.status === "DONE" ? (
              <a
                key={e._id}
                href={`/b/${businessId}/customers/exports/${e._id}`}
                className="text-brand-600 hover:underline"
              >
                Download {formatDate(e.createdAt)} ({e.rows})
              </a>
            ) : (
              <span key={e._id} className="text-slate-500">
                {e.status === "FAILED" ? "Export failed" : "Preparing… refresh in a moment"}
              </span>
            ),
          )}
        </div>
      ) : null}

      <form className="mb-4 flex gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Name, or last digits of their phone"
          className="max-w-xs"
        />
        <SecondaryButton type="submit">Search</SecondaryButton>
      </form>

      {data.length === 0 ? (
        <EmptyState>
          {q ? "No customers match." : "No customers yet. They appear here when they join."}
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {data.map((row) => (
            <Link key={row.cardId} href={`/b/${businessId}/customers/${row.customer?.id}`}>
              <Card className="flex flex-wrap items-center justify-between gap-4 py-3 transition hover:border-brand-500">
                <div>
                  <p className="font-medium">{row.customer?.name ?? "Deleted account"}</p>
                  <p className="text-sm text-slate-500">
                    {row.customer?.phone ?? row.customer?.email ?? "—"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium tabular-nums">
                    {row.stampCount} / {row.program?.requiredStamps ?? "?"} stamps
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.program?.name} · last stamp {formatDate(row.lastStampAt)}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CursorPagination
        basePath={`/b/${businessId}/customers`}
        params={{ q }}
        nextCursor={meta.nextCursor}
        isFirstPage={!cursor}
      />
    </>
  );
}
