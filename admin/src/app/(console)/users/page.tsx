import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { BRAND } from "@taptapsell/brand";
import { setUserStatusAction, signOutUserAction } from "@/app/actions";
import { apiFetchPage } from "@/lib/api";
import { can, requirePermission } from "@/lib/me";
import {
  DangerButton,
  EmptyState,
  Input,
  PageHeader,
  CursorPagination,
  SecondaryButton,
  StatusBadge,
  Table,
  Td,
  formatDate,
} from "@/components/ui";

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  platformRole: string | null;
  mfa?: { enabled?: boolean };
  createdAt: string;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const { q, cursor } = await searchParams;
  const me = await requirePermission(PLATFORM_PERMISSIONS.USER_VIEW);
  const canManage = can(me.platformRole, PLATFORM_PERMISSIONS.USER_MANAGE);

  const query = new URLSearchParams({ limit: "25" });
  if (cursor) query.set("cursor", cursor);
  if (q) query.set("q", q);
  const { data, meta } = await apiFetchPage<User[]>(`/admin/customers?${query.toString()}`);

  return (
    <>
      <PageHeader
        title="Users"
        description={`Every account: customers, business owners and staff, and the ${BRAND.name} team.`}
      />

      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Name or email" className="max-w-xs" />
        <SecondaryButton type="submit">Search</SecondaryButton>
      </form>

      {data.length === 0 ? (
        <EmptyState>No users match.</EmptyState>
      ) : (
        <Table head={["User", "Status", "Two-step", "Joined", canManage ? "Actions" : ""]}>
          {data.map((user) => (
            <tr key={user._id}>
              <Td>
                <p className="font-medium">
                  {user.name}
                  {user.platformRole ? (
                    <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">
                      {user.platformRole}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-ink-500">
                  {user.email}
                  {user.phone ? ` · ${user.phone}` : ""}
                </p>
              </Td>
              <Td>
                <StatusBadge status={user.status} />
              </Td>
              <Td>{user.mfa?.enabled ? "On" : "Off"}</Td>
              <Td>{formatDate(user.createdAt)}</Td>
              <Td>
                {canManage && user._id !== me.id ? (
                  <div className="flex flex-wrap gap-2">
                    {user.status === "SUSPENDED" ? (
                      <form action={setUserStatusAction.bind(null, user._id, "ACTIVE")}>
                        <SecondaryButton type="submit">Restore</SecondaryButton>
                      </form>
                    ) : (
                      <form action={setUserStatusAction.bind(null, user._id, "SUSPENDED")}>
                        <DangerButton type="submit">Suspend</DangerButton>
                      </form>
                    )}
                    <form action={signOutUserAction.bind(null, user._id)}>
                      <SecondaryButton type="submit">Sign out everywhere</SecondaryButton>
                    </form>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <CursorPagination
        basePath="/users"
        params={{ q }}
        nextCursor={meta.nextCursor}
        isFirstPage={!cursor}
      />
    </>
  );
}
