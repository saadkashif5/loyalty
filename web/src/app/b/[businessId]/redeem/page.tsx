import { RedeemForm } from "./RedeemForm";
import { PageHeader } from "@/components/ui";

// The counter workflow: staff enter the code the customer shows and the server
// decides whether it is valid. Nothing here trusts the client (§17.2).
export default async function RedeemPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Redeem a reward"
        description="Enter the code from the customer's app to validate their reward."
      />
      <RedeemForm businessId={businessId} />
    </div>
  );
}
