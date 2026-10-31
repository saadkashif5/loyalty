import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetchPage } from "@/lib/api";
import { can, getMe } from "@/lib/me";
import {
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Pagination,
  SecondaryButton,
  Select,
  StatusBadge,
  Table,
  Td,
  formatDate,
} from "@/components/ui";

interface Business {
  _id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  contact?: { phone?: string; address?: string };
  createdAt: string;
}

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page } = await searchParams;
  const me = await getMe();

  const query = new URLSearchParams({ page: page ?? "1", limit: "25" });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  const { data, meta } = await apiFetchPage<Business[]>(`/admin/businesses?${query.toString()}`);

  return (
    <>
      <PageHeader
        title="Businesses"
        description="Every business on the platform. Businesses join by invitation only."
        action={
          can(me.platformRole, PLATFORM_PERMISSIONS.BUSINESS_MANAGE) ? (
            <LinkButton href="/businesses/new">Invite a business</LinkButton>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Name, slug or phone" className="max-w-xs" />
        <Select name="status" defaultValue={status ?? ""} className="max-w-[12rem]">
          <option value="">All statuses</option>
          <option value="PENDING">Invited (pending)</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
        <SecondaryButton type="submit">Search</SecondaryButton>
      </form>

      {data.length === 0 ? (
        <EmptyState>No businesses match.</EmptyState>
      ) : (
        <Table head={["Business", "Category", "Status", "Phone", "Created"]}>
          {data.map((b) => (
            <tr key={b._id}>
              <Td>
                <Link
                  href={`/businesses/${b._id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {b.name}
                </Link>
                <p className="text-xs text-slate-400">{b.slug}</p>
              </Td>
              <Td>{b.category}</Td>
              <Td>
                <StatusBadge status={b.status} />
              </Td>
              <Td>{b.contact?.phone ?? "—"}</Td>
              <Td>{formatDate(b.createdAt)}</Td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/businesses"
        params={{ q, status }}
        page={meta.page}
        limit={meta.limit}
        total={meta.total}
      />
    </>
  );
}
