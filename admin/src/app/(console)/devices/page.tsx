import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetchPage } from "@/lib/api";
import { can, getMe } from "@/lib/me";
import {
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  SecondaryButton,
  Select,
  StatusBadge,
  Table,
  Td,
  formatDate,
} from "@/components/ui";
import { MintForm } from "./MintForm";
import { ResetTagForm } from "@/components/ResetTagForm";

interface Device {
  _id: string;
  deviceIdentifier: string;
  status: string;
  tagType: string;
  tagUid: string | null;
  businessId: { _id: string; name: string } | null;
  branchId: { name: string } | null;
  lastTapAt: string | null;
  createdAt: string;
}

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page } = await searchParams;
  const me = await getMe();
  const canManage = can(me.platformRole, PLATFORM_PERMISSIONS.DEVICE_MANAGE);

  const query = new URLSearchParams({ page: page ?? "1", limit: "50" });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  const { data, meta } = await apiFetchPage<Device[]>(`/admin/devices?${query.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stampers"
        description="The whole fleet. Assign a stamper from its business's page."
      />

      {canManage ? <MintForm /> : null}

      <div>
        <form className="mb-4 flex flex-wrap gap-2">
          <Input name="q" defaultValue={q} placeholder="Stamper ID" className="max-w-[12rem]" />
          <Select name="status" defaultValue={status ?? ""} className="max-w-[12rem]">
            <option value="">All statuses</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ASSIGNED">Assigned (not activated)</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REVOKED">Revoked</option>
            <option value="REPLACED">Replaced</option>
          </Select>
          <SecondaryButton type="submit">Filter</SecondaryButton>
        </form>

        {data.length === 0 ? (
          <EmptyState>No stampers match.</EmptyState>
        ) : (
          <Table head={["Stamper", "Status", "Business", "Branch", "Tag", "Last tap", "Created"]}>
            {data.map((d) => (
              <tr key={d._id}>
                <Td className="font-mono">{d.deviceIdentifier}</Td>
                <Td>
                  <StatusBadge status={d.status} />
                </Td>
                <Td>
                  {d.businessId ? (
                    <Link
                      href={`/businesses/${d.businessId._id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {d.businessId.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>{d.branchId?.name ?? "—"}</Td>
                <Td>
                  {d.tagType}
                  <div className="mt-1">
                    {canManage && d.status !== "REVOKED" && d.status !== "REPLACED" ? (
                      <ResetTagForm
                        deviceId={d._id}
                        businessId={d.businessId?._id ?? null}
                        tagUid={d.tagUid}
                      />
                    ) : null}
                  </div>
                </Td>
                <Td>{formatDate(d.lastTapAt)}</Td>
                <Td>{formatDate(d.createdAt)}</Td>
              </tr>
            ))}
          </Table>
        )}

        <Pagination
          basePath="/devices"
          params={{ q, status }}
          page={meta.page}
          limit={meta.limit}
          total={meta.total}
        />
      </div>
    </div>
  );
}
