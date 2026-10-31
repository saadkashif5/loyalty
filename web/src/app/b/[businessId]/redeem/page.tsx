import { apiFetch } from "@/lib/api";
import { getMembership } from "@/lib/membership";
import { PageHeader } from "@/components/ui";
import { RedeemForm } from "./RedeemForm";

// The counter workflow: staff enter the code the customer shows and the server
// decides whether it is valid. Nothing here trusts the client (§17.2).
export default async function RedeemPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const [{ branchIds }, allBranches] = await Promise.all([
    getMembership(businessId),
    apiFetch<Array<{ _id: string; name: string; status: string }>>(
      `/businesses/${businessId}/branches`,
    ),
  ]);
  // Branch-limited staff must say where they are; everyone else may.
  const branches = allBranches.filter(
    (b) => b.status === "ACTIVE" && (branchIds.length === 0 || branchIds.includes(b._id)),
  );

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Redeem a reward"
        description="Enter the code from the customer's app to validate their reward."
      />
      <RedeemForm businessId={businessId} branches={branches} />
    </div>
  );
}
