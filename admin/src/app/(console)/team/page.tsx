import { apiFetch } from "@/lib/api";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { requirePermission } from "@/lib/me";
import { PageHeader, StatusBadge, Table, Td, formatDate } from "@/components/ui";
import { AddTeamMemberForm, ChangeRoleForm } from "./TeamForms";

interface Member {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  status: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export default async function TeamPage() {
  const me = await requirePermission(PLATFORM_PERMISSIONS.TEAM_MANAGE);
  const team = await apiFetch<Member[]>("/admin/team");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Who can use this console. Removing someone signs them out everywhere."
      />

      <AddTeamMemberForm />

      <Table head={["Person", "Status", "Two-step", "Since", "Role"]}>
        {team.map((member) => (
          <tr key={member.id}>
            <Td>
              <p className="font-medium">{member.name}</p>
              <p className="text-xs text-slate-500">{member.email}</p>
            </Td>
            <Td>
              <StatusBadge status={member.status} />
            </Td>
            <Td>{member.mfaEnabled ? "On" : <span className="text-amber-700">Not set up</span>}</Td>
            <Td>{formatDate(member.createdAt)}</Td>
            <Td>
              {member.id === me.id ? (
                <span className="text-sm text-slate-500">{member.platformRole} (you)</span>
              ) : (
                <ChangeRoleForm userId={member.id} role={member.platformRole} />
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
