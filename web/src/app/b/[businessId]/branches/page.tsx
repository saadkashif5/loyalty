import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { CreateBranchForm } from "./CreateBranchForm";

interface Branch {
  _id: string;
  name: string;
  address?: string;
  status: string;
}

export default async function BranchesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const branches = await apiFetch<Branch[]>(`/businesses/${businessId}/branches`);

  return (
    <>
      <PageHeader title="Branches" description="Stampers and staff are assigned per branch." />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {branches.length === 0 ? (
            <EmptyState>Add your first branch to start assigning stampers.</EmptyState>
          ) : (
            branches.map((branch) => (
              <Card key={branch._id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    {branch.address ? (
                      <p className="mt-1 text-sm text-slate-500">{branch.address}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={branch.status} />
                    <Link
                      href={`/b/${businessId}/branches/${branch._id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <CreateBranchForm businessId={businessId} />
      </div>
    </>
  );
}
