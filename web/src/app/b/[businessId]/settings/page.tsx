import { apiFetch } from "@/lib/api";
import { StaffCapForm } from "./StaffCapForm";
import { Card, PageHeader } from "@/components/ui";
import { BusinessProfileForm, type BusinessProfile } from "./BusinessProfileForm";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await apiFetch<BusinessProfile & { settings?: { staffDailyStampCap?: number } }>(
    `/businesses/${businessId}`,
  );

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="How your business appears to customers." />
      <Card>
        <BusinessProfileForm businessId={businessId} profile={business} />
      </Card>
      <Card className="mt-6">
        <h2 className="mb-3 font-semibold">Limits</h2>
        <StaffCapForm businessId={businessId} cap={business.settings?.staffDailyStampCap ?? 100} />
      </Card>
    </div>
  );
}
