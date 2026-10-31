import { apiFetch } from "@/lib/api";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { InviteMemberForm } from "./InviteMemberForm";

interface Member {
  _id: string;
  role: string;
  status: string;
  userId?: { name: string; email: string } | null;
}

export default async function StaffPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const members = await apiFetch<Member[]>(`/businesses/${businessId}/members`);

  return (
    <>
      <PageHeader
        title="Staff"
        description="Managers run day-to-day loyalty operations; staff can validate rewards."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {members.length === 0 ? (
            <EmptyState>No team members yet.</EmptyState>
          ) : (
            members.map((member) => (
              <Card key={member._id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{member.userId?.name ?? "Pending user"}</p>
                    <p className="text-sm text-slate-500">
                      {member.userId?.email} · {member.role}
                    </p>
                  </div>
                  <StatusBadge status={member.status} />
                </div>
              </Card>
            ))
          )}
        </div>

        <InviteMemberForm businessId={businessId} />
      </div>
    </>
  );
}
