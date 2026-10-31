import { apiFetch } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import { BusinessProfileForm, type BusinessProfile } from "./BusinessProfileForm";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await apiFetch<BusinessProfile>(`/businesses/${businessId}`);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="How your business appears to customers." />
      <Card>
        <BusinessProfileForm businessId={businessId} profile={business} />
      </Card>
    </div>
  );
}
