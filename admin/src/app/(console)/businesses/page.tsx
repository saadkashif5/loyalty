import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch, apiFetchPage } from "@/lib/api";
import type { Plan } from "@/lib/billing";
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
  contact?: { phone?: string; address?: string; city?: string };
  plan: { code: string; name: string; status: string } | null;
  createdAt: string;
}

// For team members who cannot read the plan list (no billing access).
const DEFAULT_PLANS = ["STARTER", "GROWTH", "PRO", "ENTERPRISE"].map((code) => ({
  code,
  name: code.charAt(0) + code.slice(1).toLowerCase(),
}));

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    plan?: string;
    city?: string;
    page?: string;
  }>;
}) {
  const { q, status, plan, city, page } = await searchParams;
  const me = await getMe();

  const query = new URLSearchParams({ page: page ?? "1", limit: "25" });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (plan) query.set("plan", plan);
  if (city) query.set("city", city);
  const [{ data, meta }, cities, plans] = await Promise.all([
    apiFetchPage<Business[]>(`/admin/businesses?${query.toString()}`),
    apiFetch<string[]>("/admin/businesses/cities"),
    can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_VIEW)
      ? apiFetch<Plan[]>("/admin/plans")
      : Promise.resolve(DEFAULT_PLANS),
  ]);

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
        <Select name="plan" defaultValue={plan ?? ""} className="max-w-[12rem]">
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select name="city" defaultValue={city ?? ""} className="max-w-[12rem]">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <SecondaryButton type="submit">Search</SecondaryButton>
      </form>

      {data.length === 0 ? (
        <EmptyState>No businesses match.</EmptyState>
      ) : (
        <Table head={["Business", "Category", "Status", "Plan", "City", "Phone", "Created"]}>
          {data.map((b) => (
            <tr key={b._id}>
              <Td>
                <Link
                  href={`/businesses/${b._id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {b.name}
                </Link>
                <p className="text-xs text-ink-400">{b.slug}</p>
              </Td>
              <Td>{b.category}</Td>
              <Td>
                <StatusBadge status={b.status} />
              </Td>
              <Td>
                {b.plan ? (
                  <>
                    {b.plan.name}
                    <span className="block text-xs text-ink-400">
                      {b.plan.status.toLowerCase().replace("_", " ")}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </Td>
              <Td>{b.contact?.city ?? "—"}</Td>
              <Td>{b.contact?.phone ?? "—"}</Td>
              <Td>{formatDate(b.createdAt)}</Td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/businesses"
        params={{ q, status, plan, city }}
        page={meta.page}
        limit={meta.limit}
        total={meta.total}
      />
    </>
  );
}
