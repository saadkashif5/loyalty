import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import { EditBranchForm, type EditableBranch } from "../../EditForms";

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ businessId: string; branchId: string }>;
}) {
  const { businessId, branchId } = await params;
  const branch = await apiFetch<EditableBranch>(`/businesses/${businessId}/branches/${branchId}`);

  return (
    <div className="max-w-3xl">
      <Link
        href={`/b/${businessId}/branches`}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← Branches
      </Link>
      <PageHeader title={`Edit ${branch.name}`} />
      <Card>
        <EditBranchForm businessId={businessId} branch={branch} />
      </Card>
    </div>
  );
}
