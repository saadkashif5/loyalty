import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { Card, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";

interface Membership {
  role: string;
  business: {
    _id: string;
    name: string;
    category: string;
    status: string;
  } | null;
}

export default async function BusinessesPage() {
  let memberships: Membership[];

  try {
    memberships = await apiFetch<Membership[]>("/businesses");
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) redirect("/login");
    throw error;
  }

  const valid = memberships.filter((m) => m.business);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Your businesses"
        description="Pick a business to manage its loyalty programs, stampers and rewards."
        action={<LinkButton href="/businesses/new">Add business</LinkButton>}
      />

      {valid.length === 0 ? (
        <EmptyState>You are not part of any business yet. Create one to get started.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {valid.map((m) => (
            <li key={m.business!._id}>
              <Link href={`/b/${m.business!._id}`} className="block">
                <Card className="transition hover:border-brand-500">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{m.business!.name}</p>
                      <p className="text-sm text-slate-500">
                        {m.business!.category} · your role: {m.role}
                      </p>
                    </div>
                    <StatusBadge status={m.business!.status} />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
