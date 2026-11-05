import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetchPage } from "@/lib/api";
import { can, getMe } from "@/lib/me";
import {
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  SecondaryButton,
  Select,
  StatusBadge,
  formatDate,
} from "@/components/ui";
import { LeadUpdateForm } from "./LeadUpdateForm";

interface Lead {
  _id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  city: string;
  category: string;
  branches?: number;
  message?: string;
  status: string;
  businessId?: string;
  notes: Array<{ _id: string; text: string; at: string; by: { name: string } | null }>;
  createdAt: string;
}

function inviteHref(lead: Lead): string {
  const params = new URLSearchParams({
    leadId: lead._id,
    businessName: lead.businessName,
    category: lead.category,
    ownerName: lead.contactName,
    ownerPhone: lead.phone,
    city: lead.city,
  });
  if (lead.email) params.set("ownerEmail", lead.email);
  return `/businesses/new?${params.toString()}`;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page } = await searchParams;
  const me = await getMe();
  const canManage = can(me.platformRole, PLATFORM_PERMISSIONS.BUSINESS_MANAGE);

  const query = new URLSearchParams({ page: page ?? "1", limit: "20" });
  if (status) query.set("status", status);
  const { data, meta } = await apiFetchPage<Lead[]>(`/admin/leads?${query.toString()}`);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Businesses that asked to join through the request-access form."
      />

      <form className="mb-4 flex gap-2">
        <Select name="status" defaultValue={status ?? ""} className="max-w-[12rem]">
          <option value="">All</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="CONVERTED">Converted</option>
          <option value="REJECTED">Rejected</option>
        </Select>
        <SecondaryButton type="submit">Filter</SecondaryButton>
      </form>

      {data.length === 0 ? (
        <EmptyState>No leads here.</EmptyState>
      ) : (
        <div className="space-y-4">
          {data.map((lead) => (
            <Card key={lead._id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{lead.businessName}</p>
                  <p className="text-sm text-slate-600">
                    {lead.contactName} · {lead.phone}
                    {lead.email ? ` · ${lead.email}` : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lead.category} · {lead.city}
                    {lead.branches ? ` · ${lead.branches} branches` : ""} ·{" "}
                    {formatDate(lead.createdAt)}
                  </p>
                </div>
                <StatusBadge status={lead.status} />
              </div>

              {lead.message ? <p className="text-sm text-slate-700">“{lead.message}”</p> : null}

              {lead.notes.length > 0 ? (
                <ul className="space-y-1 border-l-2 border-slate-200 pl-3 text-sm">
                  {lead.notes.map((note) => (
                    <li key={note._id}>
                      {note.text}{" "}
                      <span className="text-xs text-slate-400">
                        — {note.by?.name ?? "someone"}, {formatDate(note.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {canManage ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <LeadUpdateForm leadId={lead._id} status={lead.status} />
                  {lead.status === "CONVERTED" && lead.businessId ? (
                    <Link
                      href={`/businesses/${lead.businessId}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      Open business →
                    </Link>
                  ) : lead.status !== "REJECTED" ? (
                    <Link
                      href={inviteHref(lead)}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      Invite this business →
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Pagination
        basePath="/leads"
        params={{ status }}
        page={meta.page}
        limit={meta.limit}
        total={meta.total}
      />
    </>
  );
}
