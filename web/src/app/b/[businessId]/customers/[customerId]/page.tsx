import Link from "next/link";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { can, getMembership } from "@/lib/membership";
import { ManualStampForm } from "./ManualStampForm";
import { Card, PageHeader, StatusBadge, formatDate } from "@/components/ui";

interface CustomerDetail {
  customer: { name: string; phone: string | null; email: string | null } | null;
  cards: Array<{
    cardId: string;
    program: { name: string; requiredStamps: number } | null;
    stampCount: number;
    status: string;
    joinedAt: string;
    lastStampAt: string | null;
  }>;
  stamps: Array<{
    _id: string;
    source: string;
    createdAt: string;
    branchId: { name: string } | null;
  }>;
  redemptions: Array<{
    _id: string;
    status: string;
    createdAt: string;
    redeemedAt?: string;
    rewardId: { name: string } | null;
  }>;
}

const SOURCE_LABEL: Record<string, string> = {
  NFC: "Tap",
  QR: "QR",
  STAFF: "Counter code",
  ADMIN: "Added by a manager",
};

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ businessId: string; customerId: string }>;
}) {
  const { businessId, customerId } = await params;
  const [detail, { role, branchIds }, allBranches] = await Promise.all([
    apiFetch<CustomerDetail>(`/businesses/${businessId}/customers/${customerId}`),
    getMembership(businessId),
    apiFetch<Array<{ _id: string; name: string; status: string }>>(
      `/businesses/${businessId}/branches`,
    ),
  ]);
  const canStamp = can(role, BUSINESS_PERMISSIONS.STAMP_ISSUE_MANUAL);
  const branches = allBranches.filter(
    (b) => b.status === "ACTIVE" && (branchIds.length === 0 || branchIds.includes(b._id)),
  );

  return (
    <div className="space-y-6">
      <Link href={`/b/${businessId}/customers`} className="text-sm text-ink-500 hover:text-ink-900">
        ← Customers
      </Link>
      <PageHeader
        title={detail.customer?.name ?? "Deleted account"}
        description={[detail.customer?.phone, detail.customer?.email].filter(Boolean).join(" · ")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {detail.cards.map((card) => (
          <Card key={card.cardId}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{card.program?.name}</p>
              <StatusBadge status={card.status} />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {card.stampCount} / {card.program?.requiredStamps}
            </p>
            <p className="text-xs text-ink-500">
              Joined {formatDate(card.joinedAt)} · last stamp {formatDate(card.lastStampAt)}
            </p>
            {canStamp && card.status === "ACTIVE" ? (
              <ManualStampForm businessId={businessId} cardId={card.cardId} branches={branches} />
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Recent stamps</h2>
          {detail.stamps.length === 0 ? (
            <p className="text-sm text-ink-500">None yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {detail.stamps.map((stamp) => (
                <li key={stamp._id} className="flex justify-between gap-4 py-2">
                  <span>
                    {SOURCE_LABEL[stamp.source] ?? stamp.source}
                    {stamp.branchId ? ` · ${stamp.branchId.name}` : ""}
                  </span>
                  <span className="text-ink-500">{formatDate(stamp.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Rewards</h2>
          {detail.redemptions.length === 0 ? (
            <p className="text-sm text-ink-500">None yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {detail.redemptions.map((r) => (
                <li key={r._id} className="flex items-center justify-between gap-4 py-2">
                  <span>{r.rewardId?.name ?? "Reward"}</span>
                  <span className="flex items-center gap-2 text-ink-500">
                    {formatDate(r.redeemedAt ?? r.createdAt)}
                    <StatusBadge status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
