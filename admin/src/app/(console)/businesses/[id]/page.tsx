import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch, apiFetchPage } from "@/lib/api";
import { can, getMe } from "@/lib/me";
import { Card, PageHeader, Stat, StatusBadge, Table, Td, formatDate } from "@/components/ui";
import { AssignDeviceForm, InvitationActions, StatusForm } from "./BusinessActions";
import { SubscriptionCard } from "./SubscriptionCard";
import type { BillingSummary, Plan } from "@/lib/billing";

interface Detail {
  business: {
    _id: string;
    name: string;
    slug: string;
    category: string;
    status: string;
    description?: string;
    contact?: { phone?: string; email?: string; address?: string };
    createdAt: string;
  };
  members: Array<{
    _id: string;
    role: string;
    status: string;
    userId: { name: string; email: string; phone?: string } | null;
  }>;
  branches: Array<{ _id: string; name: string; address?: string; status: string }>;
  devices: Array<{
    _id: string;
    deviceIdentifier: string;
    status: string;
    tagType: string;
    branchId: { name: string } | null;
    lastTapAt: string | null;
  }>;
  invitations: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    expiresAt: string;
    sendCount: number;
    acceptedAt: string | null;
  }>;
  counts: { customers: number; stamps: number; redemptions: number };
}

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  const canManage = can(me.platformRole, PLATFORM_PERMISSIONS.BUSINESS_MANAGE);
  const canAssign = can(me.platformRole, PLATFORM_PERMISSIONS.DEVICE_MANAGE);
  const canSeeBilling = can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_VIEW);
  const canManageBilling = can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_MANAGE);

  const [detail, unassigned, billing, plans] = await Promise.all([
    apiFetch<Detail>(`/admin/businesses/${id}`),
    canAssign
      ? apiFetchPage<Array<{ _id: string; deviceIdentifier: string }>>(
          "/admin/devices?status=UNASSIGNED&limit=100",
        )
      : Promise.resolve(null),
    canSeeBilling
      ? apiFetch<BillingSummary>(`/admin/businesses/${id}/billing`)
      : Promise.resolve(null),
    canManageBilling ? apiFetch<Plan[]>("/admin/plans") : Promise.resolve([] as Plan[]),
  ]);
  const { business } = detail;

  return (
    <div className="space-y-6">
      <Link href="/businesses" className="text-sm text-slate-500 hover:text-slate-900">
        ← Businesses
      </Link>
      <PageHeader
        title={business.name}
        description={`${business.category} · ${business.slug} · joined ${formatDate(business.createdAt)}`}
        action={<StatusBadge status={business.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Loyalty customers" value={detail.counts.customers} />
        <Stat label="Stamps issued" value={detail.counts.stamps} />
        <Stat label="Rewards unlocked" value={detail.counts.redemptions} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-2 text-sm">
          <h2 className="font-semibold">Contact</h2>
          <p>Phone: {business.contact?.phone ?? "—"}</p>
          <p>Email: {business.contact?.email ?? "—"}</p>
          <p>Address: {business.contact?.address ?? "—"}</p>
          {business.description ? <p className="text-slate-500">{business.description}</p> : null}
        </Card>

        {canManage && business.status !== "PENDING" ? (
          <Card>
            <h2 className="mb-3 font-semibold">Status</h2>
            <StatusForm businessId={business._id} status={business.status} />
          </Card>
        ) : null}
      </div>

      {billing ? (
        <SubscriptionCard
          businessId={business._id}
          billing={billing}
          plans={plans}
          canManage={canManageBilling}
        />
      ) : null}

      <section>
        <h2 className="mb-3 font-semibold">Owner invitations</h2>
        {detail.invitations.length === 0 ? (
          <p className="text-sm text-slate-500">None.</p>
        ) : (
          <Table head={["Invited", "Status", "Expires", "Sent", canManage ? "Actions" : ""]}>
            {detail.invitations.map((inv) => (
              <tr key={inv.id}>
                <Td>
                  <p className="font-medium">{inv.name}</p>
                  <p className="text-xs text-slate-500">
                    {inv.email}
                    {inv.phone ? ` · ${inv.phone}` : ""}
                  </p>
                </Td>
                <Td>
                  <StatusBadge status={inv.status} />
                </Td>
                <Td>
                  {inv.status === "ACCEPTED"
                    ? formatDate(inv.acceptedAt)
                    : formatDate(inv.expiresAt)}
                </Td>
                <Td>{inv.sendCount}×</Td>
                <Td>
                  {canManage && (inv.status === "PENDING" || inv.status === "EXPIRED") ? (
                    <InvitationActions invitationId={inv.id} businessId={business._id} />
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">People</h2>
        {detail.members.length === 0 ? (
          <p className="text-sm text-slate-500">Nobody yet — the owner has not accepted.</p>
        ) : (
          <Table head={["Name", "Role", "Status"]}>
            {detail.members.map((m) => (
              <tr key={m._id}>
                <Td>
                  <p className="font-medium">{m.userId?.name ?? "Deleted user"}</p>
                  <p className="text-xs text-slate-500">{m.userId?.email}</p>
                </Td>
                <Td>{m.role}</Td>
                <Td>
                  <StatusBadge status={m.status} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Branches</h2>
        {detail.branches.length === 0 ? (
          <p className="text-sm text-slate-500">No branches yet.</p>
        ) : (
          <Table head={["Branch", "Address", "Status"]}>
            {detail.branches.map((b) => (
              <tr key={b._id}>
                <Td className="font-medium">{b.name}</Td>
                <Td>{b.address ?? "—"}</Td>
                <Td>
                  <StatusBadge status={b.status} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Stampers</h2>
        {detail.devices.length > 0 ? (
          <Table head={["Stamper", "Branch", "Status", "Tag", "Last tap"]}>
            {detail.devices.map((d) => (
              <tr key={d._id}>
                <Td className="font-mono">{d.deviceIdentifier}</Td>
                <Td>{d.branchId?.name ?? "—"}</Td>
                <Td>
                  <StatusBadge status={d.status} />
                </Td>
                <Td>{d.tagType}</Td>
                <Td>{formatDate(d.lastTapAt)}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="text-sm text-slate-500">No stampers assigned yet.</p>
        )}
        {canAssign && unassigned && business.status !== "SUSPENDED" ? (
          <Card>
            <h3 className="mb-3 text-sm font-semibold">Assign a stamper</h3>
            <AssignDeviceForm
              businessId={business._id}
              devices={unassigned.data}
              branches={detail.branches.filter((b) => b.status === "ACTIVE")}
            />
          </Card>
        ) : null}
      </section>
    </div>
  );
}
