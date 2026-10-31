import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { reviewFlagAction } from "@/app/actions/business";
import {
  Card,
  DangerButton,
  EmptyState,
  PageHeader,
  SecondaryButton,
  StatusBadge,
  formatDate,
} from "@/components/ui";

interface Flag {
  _id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  occurrences: number;
  lastSeenAt: string;
  createdAt: string;
  status: string;
  deviceId: { deviceIdentifier: string } | null;
  staffUserId: { name: string; email: string } | null;
}

const TITLES: Record<string, string> = {
  DEVICE_BURST: "Unusually many stamps from one stamper",
  TAP_REPLAYED: "A stamper link was used again",
  TAG_MISMATCH: "A copied stamper may be in use",
  STAFF_DAILY_CAP: "A staff member hit the daily stamp limit",
};

const SEVERITY: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-slate-100 text-slate-600",
};

export default async function AlertsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { businessId } = await params;
  const { status } = await searchParams;
  const showing = status === "ALL" ? "ALL" : "OPEN";
  const flags = await apiFetch<Flag[]>(`/businesses/${businessId}/fraud-flags?status=${showing}`);

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Stamping that looks unusual. Most alerts have an innocent explanation — check before acting."
        action={
          <Link
            href={`/b/${businessId}/alerts${showing === "OPEN" ? "?status=ALL" : ""}`}
            className="text-sm text-brand-600 hover:underline"
          >
            {showing === "OPEN" ? "Show reviewed too" : "Show open only"}
          </Link>
        }
      />

      {flags.length === 0 ? (
        <EmptyState>Nothing to review. 👍</EmptyState>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => (
            <Card key={flag._id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{TITLES[flag.type] ?? flag.type}</p>
                  <p className="text-sm text-slate-600">{flag.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {flag.deviceId ? `Stamper ${flag.deviceId.deviceIdentifier} · ` : ""}
                    {flag.staffUserId ? `${flag.staffUserId.name} · ` : ""}
                    {flag.occurrences > 1 ? `${flag.occurrences} times · ` : ""}
                    last {formatDate(flag.lastSeenAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY[flag.severity]}`}
                  >
                    {flag.severity.toLowerCase()}
                  </span>
                  {flag.status !== "OPEN" ? <StatusBadge status={flag.status} /> : null}
                </div>
              </div>
              {flag.status === "OPEN" ? (
                <div className="flex flex-wrap gap-2">
                  <form action={reviewFlagAction.bind(null, businessId, flag._id, "DISMISSED")}>
                    <SecondaryButton type="submit">Nothing wrong</SecondaryButton>
                  </form>
                  <form action={reviewFlagAction.bind(null, businessId, flag._id, "CONFIRMED")}>
                    <DangerButton type="submit">Confirm problem</DangerButton>
                  </form>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
