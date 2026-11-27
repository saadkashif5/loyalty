import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { can, getMembership } from "@/lib/membership";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { InviteMemberForm } from "./InviteMemberForm";
import { ManageMemberForm } from "./ManageMemberForm";

interface Member {
  _id: string;
  role: string;
  status: string;
  branchIds: string[];
  userId?: { name: string; email: string } | null;
}

export default async function StaffPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { role } = await getMembership(businessId);
  const canManage = can(role, BUSINESS_PERMISSIONS.MEMBER_MANAGE);

  const [members, branches] = await Promise.all([
    apiFetch<Member[]>(`/businesses/${businessId}/members`),
    apiFetch<Array<{ _id: string; name: string }>>(`/businesses/${businessId}/branches`),
  ]);
  const branchName = new Map(branches.map((b) => [b._id, b.name]));

  return (
    <>
      <PageHeader
        title="Staff"
        description="Managers run day-to-day loyalty operations; staff validate rewards at the counter."
      />

      <div className={`grid gap-6 ${canManage ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
        <div className="space-y-3">
          {members.length === 0 ? (
            <EmptyState>No team members yet.</EmptyState>
          ) : (
            members.map((member) => (
              <Card key={member._id} className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{member.userId?.name ?? "Pending user"}</p>
                    <p className="text-sm text-ink-500">
                      {member.userId?.email} · {member.role.toLowerCase()} ·{" "}
                      {member.branchIds.length === 0
                        ? "all branches"
                        : member.branchIds.map((id) => branchName.get(id) ?? "?").join(", ")}
                    </p>
                  </div>
                  <StatusBadge status={member.status} />
                </div>
                {canManage && member.role !== "OWNER" ? (
                  <ManageMemberForm
                    businessId={businessId}
                    member={{ ...member, branchIds: member.branchIds.map(String) }}
                    branches={branches}
                  />
                ) : null}
              </Card>
            ))
          )}
        </div>

        {canManage ? <InviteMemberForm businessId={businessId} /> : null}
      </div>
    </>
  );
}
