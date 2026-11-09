import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { requirePermission } from "@/lib/me";
import { EmptyState, PageHeader, Stat, Table, Td } from "@/components/ui";

interface Metrics {
  days: number;
  totals: {
    tapsVerified: number;
    tapsRejected: number;
    stamps: number;
    newCards: number;
    rewardsUnlocked: number;
    rewardsRedeemed: number;
    cards: number;
    returning: number;
    tapSuccessPercent: number | null;
    repeatPercent: number | null;
    redemptionPercent: number | null;
    activeCards: number;
  };
  businesses: Array<{
    businessId: string;
    name: string;
    city: string | null;
    stamps: number;
    newCards: number;
    tapSuccessPercent: number | null;
    repeatPercent: number | null;
    redemptionPercent: number | null;
  }>;
}

const WINDOWS = [7, 30, 90];
const pct = (value: number | null) => (value === null ? "—" : `${value}%`);

export default async function PilotPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requirePermission(PLATFORM_PERMISSIONS.ANALYTICS_VIEW);
  const days = WINDOWS.includes(Number((await searchParams).days))
    ? Number((await searchParams).days)
    : 30;
  const { totals, businesses } = await apiFetch<Metrics>(`/admin/metrics/pilot?days=${days}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pilot"
        description="Do taps work, do customers come back, do they use their rewards."
        action={
          <div className="flex gap-1 text-sm">
            {WINDOWS.map((d) => (
              <Link
                key={d}
                href={`/pilot?days=${d}`}
                className={`rounded-md px-3 py-1.5 ${
                  d === days ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
                }`}
              >
                {d} days
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={`Tap success (${totals.tapsVerified} of ${totals.tapsVerified + totals.tapsRejected})`}
          value={pct(totals.tapSuccessPercent)}
        />
        <Stat
          label={`Came back on another day (${totals.returning} of ${totals.cards} cards)`}
          value={pct(totals.repeatPercent)}
        />
        <Stat
          label={`Rewards used (${totals.rewardsRedeemed} of ${totals.rewardsUnlocked})`}
          value={pct(totals.redemptionPercent)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Stamps" value={totals.stamps} />
        <Stat label="New cards" value={totals.newCards} />
        <Stat label="Cards stamped in this period" value={totals.activeCards} />
      </div>
      <p className="text-xs text-slate-500">
        A tap fails when the stamper link cannot be read, was used before, or came from a different
        chip. Counting started with this release, so earlier days show no taps.
      </p>

      {businesses.length === 0 ? (
        <EmptyState>No active businesses yet.</EmptyState>
      ) : (
        <Table
          head={[
            "Business",
            "City",
            "Stamps",
            "New cards",
            "Tap success",
            "Came back",
            "Rewards used",
          ]}
        >
          {businesses.map((b) => (
            <tr key={b.businessId}>
              <Td>
                <Link
                  href={`/businesses/${b.businessId}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {b.name}
                </Link>
              </Td>
              <Td>{b.city ?? "—"}</Td>
              <Td>{b.stamps}</Td>
              <Td>{b.newCards}</Td>
              <Td>{pct(b.tapSuccessPercent)}</Td>
              <Td>{pct(b.repeatPercent)}</Td>
              <Td>{pct(b.redemptionPercent)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
