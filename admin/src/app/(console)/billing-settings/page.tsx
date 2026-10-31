import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { can, requirePermission } from "@/lib/me";
import { PageHeader } from "@/components/ui";
import { BillingSettingsForm, type BillingSettings } from "./BillingSettingsForm";

export default async function BillingSettingsPage() {
  const me = await requirePermission(PLATFORM_PERMISSIONS.BILLING_VIEW);
  const settings = await apiFetch<BillingSettings>("/admin/settings/billing");

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Billing settings"
        description="Who issues invoices, the tax rate, and where business owners send payment."
      />
      <BillingSettingsForm
        settings={settings}
        canEdit={can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_MANAGE)}
      />
    </div>
  );
}
