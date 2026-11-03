import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetchPage } from "@/lib/api";
import { requirePermission } from "@/lib/me";
import {
  EmptyState,
  Input,
  PageHeader,
  CursorPagination,
  SecondaryButton,
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

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; cursor?: string }>;
}) {
  await requirePermission(PLATFORM_PERMISSIONS.AUDIT_VIEW);
  const { businessId, cursor } = await searchParams;
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  if (businessId) query.set("businessId", businessId);
  const { data, meta } = await apiFetchPage<AuditEntry[]>(`/admin/audit-logs?${query.toString()}`);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sensitive action on the platform, newest first."
      />

      <form className="mb-4 flex gap-2">
        <Input
          name="businessId"
          defaultValue={businessId}
          placeholder="Business ID (optional)"
          className="max-w-xs font-mono"
        />
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
                  <span className="block font-mono text-slate-400">{entry.resourceId}</span>
                ) : null}
              </Td>
              <Td className="max-w-xs break-words font-mono text-xs text-slate-500">
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
        params={{ businessId }}
        nextCursor={meta.nextCursor}
        isFirstPage={!cursor}
      />
    </>
  );
}
