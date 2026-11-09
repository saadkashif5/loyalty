import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch, apiFetchPage } from "@/lib/api";
import { can, getMe } from "@/lib/me";
import { Card, PageHeader, Stat, StatusBadge, Table, Td, formatDate } from "@/components/ui";
import { AssignDeviceForm, InvitationActions, StatusForm } from "./BusinessActions";
import { SubscriptionCard } from "./SubscriptionCard";
import { SupportViewForm } from "./SupportView";
import { ShipForm } from "./ShipForm";
import { AddNoteForm } from "./Notes";
import { ResetTagForm } from "@/components/ResetTagForm";
import type { BillingSummary, Plan } from "@/lib/billing";

interface Detail {
  business: {
    _id: string;
    name: string;
    slug: string;
    category: string;
    status: string;
    description?: string;
    contact?: { phone?: string; email?: string; address?: string; city?: string };
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
    tagUid: string | null;
    shipment?: { shippedAt?: string; courier?: string; trackingNumber?: string } | null;
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
  supportViews: Array<{
    id: string;
    by: { _id: string; name: string; email: string } | null;
    reason: string;
    startedAt: string;
    expiresAt: string;
    endedAt: string | null;
    active: boolean;
    pagesViewed: number;
  }>;
  dashboardUrl: string;
  counts: { customers: number; stamps: number; redemptions: number };
}

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  const canManage = can(me.platformRole, PLATFORM_PERMISSIONS.BUSINESS_MANAGE);
  const canAssign = can(me.platformRole, PLATFORM_PERMISSIONS.DEVICE_MANAGE);
  const canSeeBilling = can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_VIEW);
  const canManageBilling = can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const canViewAs = can(me.platformRole, PLATFORM_PERMISSIONS.BUSINESS_VIEW_AS);

  const [detail, notes, unassigned, billing, plans] = await Promise.all([
    apiFetch<Detail>(`/admin/businesses/${id}`),
    apiFetch<
      Array<{ _id: string; body: string; createdAt: string; authorId: { name: string } | null }>
    >(`/admin/businesses/${id}/notes`),
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
  const myView = detail.supportViews.find((v) => v.active && v.by?._id === me.id) ?? null;

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
          <p>City: {business.contact?.city ?? "—"}</p>
          {business.description ? <p className="text-slate-500">{business.description}</p> : null}
        </Card>

        {canManage && business.status !== "PENDING" ? (
          <Card>
            <h2 className="mb-3 font-semibold">Status</h2>
            <StatusForm businessId={business._id} status={business.status} />
          </Card>
        ) : null}
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">Support notes</h2>
        <AddNoteForm businessId={business._id} />
        {notes.length > 0 ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {notes.map((n) => (
              <li key={n._id} className="py-2">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {n.authorId?.name ?? "Someone"} · {formatDate(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {canViewAs && business.status !== "PENDING" ? (
        <Card className="space-y-4">
          <h2 className="font-semibold">Support view</h2>
          <SupportViewForm
            businessId={business._id}
            active={myView}
            dashboardUrl={detail.dashboardUrl}
          />
          {detail.supportViews.length > 0 ? (
            <Table head={["Started", "By", "Reason", "Pages", "Status"]}>
              {detail.supportViews.map((v) => (
                <tr key={v.id}>
                  <Td className="whitespace-nowrap">{formatDate(v.startedAt)}</Td>
                  <Td>{v.by?.email ?? "—"}</Td>
                  <Td>{v.reason}</Td>
                  <Td>{v.pagesViewed}</Td>
                  <Td>
                    <StatusBadge status={v.active ? "ACTIVE" : "ENDED"} />
                  </Td>
                </tr>
              ))}
            </Table>
          ) : null}
        </Card>
      ) : null}

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
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">Stampers</h2>
          {detail.devices.length > 0 ? (
            <Link
              href={`/devices/labels?ids=${detail.devices.map((d) => d._id).join(",")}&back=/businesses/${business._id}`}
              className="text-sm text-brand-600 hover:underline"
            >
              Print labels
            </Link>
          ) : null}
        </div>
        {detail.devices.length > 0 ? (
          <Table head={["Stamper", "Branch", "Status", "Shipping", "Tag", "Last tap"]}>
            {detail.devices.map((d) => (
              <tr key={d._id}>
                <Td className="font-mono">{d.deviceIdentifier}</Td>
                <Td>{d.branchId?.name ?? "—"}</Td>
                <Td>
                  <StatusBadge status={d.status} />
                </Td>
                <Td className="text-xs">
                  {d.shipment?.shippedAt ? (
                    <>
                      Shipped {formatDate(d.shipment.shippedAt)}
                      {d.shipment.courier ? (
                        <span className="block text-slate-500">
                          {d.shipment.courier}
                          {d.shipment.trackingNumber ? ` · ${d.shipment.trackingNumber}` : ""}
                        </span>
                      ) : null}
                    </>
                  ) : canAssign && d.status === "ASSIGNED" ? (
                    <ShipForm deviceId={d._id} businessId={business._id} />
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  {d.tagType}
                  <div className="mt-1">
                    {canAssign && d.status !== "REVOKED" && d.status !== "REPLACED" ? (
                      <ResetTagForm deviceId={d._id} businessId={business._id} tagUid={d.tagUid} />
                    ) : d.tagUid ? (
                      <span className="font-mono text-xs text-slate-500">{d.tagUid}</span>
                    ) : null}
                  </div>
                </Td>
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
