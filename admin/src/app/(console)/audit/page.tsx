import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetchPage } from "@/lib/api";
import { requirePermission } from "@/lib/me";
import {
  EmptyState,
  Input,
  PageHeader,
  CursorPagination,
  SecondaryButton,
  Select,
  Table,
  Td,
  formatDate,
} from "@/components/ui";

interface AuditEntry {
  _id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  businessId?: string;
  actorUserId: { name: string; email: string } | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface Filters {
  businessId?: string;
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
}

const FILTER_KEYS = ["businessId", "action", "actor", "from", "to"] as const;

// A family ends in a dot and matches every action in it.
const ACTION_FAMILIES: Array<[string, string]> = [
  ["business.", "Businesses"],
  ["invitation.", "Owner invitations"],
  ["lead.", "Leads"],
  ["user.", "Accounts"],
  ["platform.", "Platform team"],
  ["support.", "Support views"],
  ["member.", "Staff"],
  ["branch.", "Branches"],
  ["program.", "Programs"],
  ["reward.", "Rewards"],
  ["stamp.", "Stamps"],
  ["redemption.", "Redemptions"],
  ["device.", "Stampers"],
  ["fraud.", "Alerts"],
  ["plan.", "Plans"],
  ["subscription.", "Subscriptions"],
  ["invoice.", "Invoices"],
  ["payment.", "Payments"],
  ["payment_proof.", "Receipts"],
  ["billing.", "Billing settings"],
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Filters & { cursor?: string }>;
}) {
  await requirePermission(PLATFORM_PERMISSIONS.AUDIT_VIEW);
  const { cursor, ...filters } = await searchParams;
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  for (const key of FILTER_KEYS) {
    const value = filters[key]?.trim();
    if (value) query.set(key, value);
  }
  const { businessId, action, actor, from, to } = filters;
  const { data, meta } = await apiFetchPage<AuditEntry[]>(`/admin/audit-logs?${query.toString()}`);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sensitive action on the platform, newest first."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Select name="action" defaultValue={action ?? ""} className="max-w-[12rem]">
          <option value="">All actions</option>
          {ACTION_FAMILIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          name="actor"
          type="email"
          defaultValue={actor}
          placeholder="Done by (email)"
          className="max-w-[14rem]"
        />
        <Input
          name="businessId"
          defaultValue={businessId}
          placeholder="Business ID"
          className="max-w-[14rem] font-mono"
        />
        <label className="text-xs text-ink-500">
          From
          <Input name="from" type="date" defaultValue={from} className="block" />
        </label>
        <label className="text-xs text-ink-500">
          To
          <Input name="to" type="date" defaultValue={to} className="block" />
        </label>
        <SecondaryButton type="submit">Filter</SecondaryButton>
      </form>

      {data.length === 0 ? (
        <EmptyState>Nothing recorded.</EmptyState>
      ) : (
        <Table head={["When", "Action", "By", "On", "Details"]}>
          {data.map((entry) => (
            <tr key={entry._id}>
              <Td className="whitespace-nowrap">{formatDate(entry.createdAt)}</Td>
              <Td className="font-mono text-xs">{entry.action}</Td>
              <Td>{entry.actorUserId ? entry.actorUserId.email : "System / anonymous"}</Td>
              <Td className="text-xs">
                {entry.resourceType}
                {entry.resourceId ? (
                  <span className="block font-mono text-ink-400">{entry.resourceId}</span>
                ) : null}
              </Td>
              <Td className="max-w-xs break-words font-mono text-xs text-ink-500">
                {entry.metadata && Object.keys(entry.metadata).length > 0
                  ? JSON.stringify(entry.metadata)
                  : ""}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <CursorPagination
        basePath="/audit"
        params={{ businessId, action, actor, from, to }}
        nextCursor={meta.nextCursor}
        isFirstPage={!cursor}
      />
    </>
  );
}
