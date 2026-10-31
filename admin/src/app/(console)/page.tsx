import { apiFetch, apiFetchPage } from "@/lib/api";
import { getMe } from "@/lib/me";
import { PageHeader, Stat } from "@/components/ui";

interface Overview {
  businesses: number;
  activeBusinesses: number;
  customers: number;
  devices: number;
  activeDevices: number;
  stamps: number;
  cards: number;
}

export default async function OverviewPage() {
  // Turns away non-team accounts before any admin call (the layout renders in parallel).
  await getMe();
  const [overview, pending, suspended, newLeads, unassigned] = await Promise.all([
    apiFetch<Overview>("/admin/overview"),
    apiFetchPage<unknown[]>("/admin/businesses?status=PENDING&limit=1"),
    apiFetchPage<unknown[]>("/admin/businesses?status=SUSPENDED&limit=1"),
    apiFetchPage<unknown[]>("/admin/leads?status=NEW&limit=1"),
    apiFetchPage<unknown[]>("/admin/devices?status=UNASSIGNED&limit=1"),
  ]);

  return (
    <>
      <PageHeader title="Overview" description="The whole platform at a glance." />

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Needs attention</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New leads" value={newLeads.meta.total} href="/leads?status=NEW" />
        <Stat
          label="Invited, not yet accepted"
          value={pending.meta.total}
          href="/businesses?status=PENDING"
        />
        <Stat
          label="Suspended businesses"
          value={suspended.meta.total}
          href="/businesses?status=SUSPENDED"
        />
        <Stat
          label="Stampers ready to assign"
          value={unassigned.meta.total}
          href="/devices?status=UNASSIGNED"
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Platform</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active businesses" value={overview.activeBusinesses} />
        <Stat label="All businesses" value={overview.businesses} />
        <Stat label="Accounts" value={overview.customers} />
        <Stat label="Loyalty cards" value={overview.cards} />
        <Stat label="Active stampers" value={overview.activeDevices} />
        <Stat label="All stampers" value={overview.devices} />
        <Stat label="Stamps issued" value={overview.stamps} />
      </div>
    </>
  );
}
