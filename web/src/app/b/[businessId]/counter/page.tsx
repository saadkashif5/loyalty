import { apiFetch } from "@/lib/api";
import { getMembership } from "@/lib/membership";
import { PageHeader } from "@/components/ui";
import { CounterForm } from "./CounterForm";

// For customers whose phone cannot tap the stamper: their card shows a short
// code that changes every few minutes, which staff scan or type here.
export default async function CounterPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const [{ branchIds }, allBranches] = await Promise.all([
    getMembership(businessId),
    apiFetch<Array<{ _id: string; name: string; status: string }>>(
      `/businesses/${businessId}/branches`,
    ),
  ]);
  const branches = allBranches.filter(
    (b) => b.status === "ACTIVE" && (branchIds.length === 0 || branchIds.includes(b._id)),
  );

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Add a stamp"
        description="For customers whose phone cannot tap the stamper."
      />
      <CounterForm businessId={businessId} branches={branches} />
    </div>
  );
}
