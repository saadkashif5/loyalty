import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getMe } from "@/lib/me";
import { EmptyState, PageHeader, StatusBadge, Table, Td, formatDate } from "@/components/ui";

interface Flag {
  _id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  occurrences: number;
  lastSeenAt: string;
  status: string;
  businessId: { _id: string; name: string } | null;
  deviceId: { deviceIdentifier: string } | null;
  staffUserId: { name: string } | null;
}

const SEVERITY: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-slate-100 text-slate-600",
};

/** Suspicious stamping across every business, so the team can spot patterns owners miss. */
export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await getMe();
  const { status } = await searchParams;
  const showing = status === "ALL" ? "ALL" : "OPEN";
  const flags = await apiFetch<Flag[]>(`/admin/fraud-flags?status=${showing}`);

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Suspicious stamping across all businesses. Owners review their own; this is the overview."
        action={
          <Link
            href={showing === "OPEN" ? "/alerts?status=ALL" : "/alerts"}
            className="text-sm text-brand-600 hover:underline"
          >
            {showing === "OPEN" ? "Include reviewed" : "Open only"}
          </Link>
        }
      />

      {flags.length === 0 ? (
        <EmptyState>No alerts.</EmptyState>
      ) : (
        <Table head={["Business", "Alert", "Severity", "Seen", "Status"]}>
          {flags.map((flag) => (
            <tr key={flag._id}>
              <Td>
                {flag.businessId ? (
                  <Link
                    href={`/businesses/${flag.businessId._id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {flag.businessId.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Td>
              <Td>
                <p>{flag.message}</p>
                <p className="text-xs text-slate-500">
                  {flag.type}
                  {flag.deviceId ? ` · ${flag.deviceId.deviceIdentifier}` : ""}
                  {flag.staffUserId ? ` · ${flag.staffUserId.name}` : ""}
                </p>
              </Td>
              <Td>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY[flag.severity]}`}
                >
                  {flag.severity.toLowerCase()}
                </span>
              </Td>
              <Td className="whitespace-nowrap">
                {flag.occurrences > 1 ? `${flag.occurrences}× · ` : ""}
                {formatDate(flag.lastSeenAt)}
              </Td>
              <Td>
                <StatusBadge status={flag.status} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
