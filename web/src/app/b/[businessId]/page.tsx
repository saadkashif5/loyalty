import Link from "next/link";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { can, getMembership } from "@/lib/membership";
import { Card, PageHeader, Stat } from "@/components/ui";
import { SetupChecklist, type OnboardingStatus } from "./SetupChecklist";

interface Overview {
  totalCustomers: number;
  activeCustomers: number;
  totalStamps: number;
  rewardsUnlocked: number;
  rewardsRedeemed: number;
  redemptionRate: number | null;
  averageStampsPerCustomer: number;
}

interface DayCount {
  date: string;
  count: number;
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { role } = await getMembership(businessId);

  // Cashiers and other staff get a counter-focused home instead of analytics.
  if (!can(role, BUSINESS_PERMISSIONS.ANALYTICS_VIEW)) {
    return <StaffHome businessId={businessId} />;
  }

  const [overview, stamps, onboarding] = await Promise.all([
    apiFetch<Overview>(`/businesses/${businessId}/analytics/overview`),
    apiFetch<DayCount[]>(`/businesses/${businessId}/analytics/stamps?days=14`),
    apiFetch<OnboardingStatus>(`/businesses/${businessId}/onboarding`),
  ]);

  const peak = Math.max(1, ...stamps.map((d) => d.count));

  return (
    <>
      {!onboarding.ready && can(role, BUSINESS_PERMISSIONS.PROGRAM_MANAGE) ? (
        <SetupChecklist businessId={businessId} status={onboarding} />
      ) : null}

      <PageHeader title="Overview" description="Loyalty activity based on recorded transactions." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Loyalty customers" value={overview.totalCustomers} />
        <Stat label="Active (30 days)" value={overview.activeCustomers} />
        <Stat label="Stamps issued" value={overview.totalStamps} />
        <Stat
          label="Avg stamps per customer"
          value={overview.averageStampsPerCustomer.toFixed(1)}
        />
        <Stat label="Rewards unlocked" value={overview.rewardsUnlocked} />
        <Stat label="Rewards redeemed" value={overview.rewardsRedeemed} />
        <Stat
          label="Redemption rate"
          value={
            overview.redemptionRate === null ? "—" : `${Math.round(overview.redemptionRate * 100)}%`
          }
          hint={overview.rewardsUnlocked === 0 ? "No rewards unlocked yet" : undefined}
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-700">Stamps, last 14 days</h2>
      <Card>
        {stamps.length === 0 ? (
          <p className="text-sm text-slate-500">No stamps recorded yet.</p>
        ) : (
          <ol className="flex h-40 items-end gap-1">
            {stamps.map((day) => (
              <li key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-brand-500"
                  style={{ height: `${(day.count / peak) * 100}%` }}
                  title={`${day.date}: ${day.count}`}
                />
                <span className="text-[10px] text-slate-400">{day.date.slice(5)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

function StaffHome({ businessId }: { businessId: string }) {
  const links = [
    { href: "/redeem", title: "Redeem a reward", text: "Enter the code a customer shows you." },
    {
      href: "/counter",
      title: "Add a stamp",
      text: "For a customer whose phone cannot tap the stamper.",
    },
    {
      href: "/customers",
      title: "Find a customer",
      text: "Search by name or the last digits of their phone.",
    },
    { href: "/devices", title: "Stampers", text: "Report a stamper that is lost or not working." },
  ];

  return (
    <>
      <PageHeader title="Counter" description="What you can do from here." />
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={`/b/${businessId}${link.href}`}>
            <Card className="h-full transition hover:border-brand-500">
              <p className="font-medium">{link.title}</p>
              <p className="mt-1 text-sm text-slate-500">{link.text}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
