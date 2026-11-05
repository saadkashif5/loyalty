import Link from "next/link";
import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { requirePermission } from "@/lib/me";
import { labelQr } from "@/lib/qr";
import { EmptyState, PageHeader } from "@/components/ui";
import { LabelSheet } from "@/components/LabelSheet";

interface DeviceLabel {
  deviceIdentifier: string;
  business: string | null;
  branch: string | null;
  activateUrl: string;
}

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; back?: string }>;
}) {
  await requirePermission(PLATFORM_PERMISSIONS.BUSINESS_VIEW);
  const { ids, back } = await searchParams;
  const labels = ids
    ? await apiFetch<DeviceLabel[]>(`/admin/devices/labels?ids=${encodeURIComponent(ids)}`)
    : [];
  const withQr = await Promise.all(
    labels.map(async (l) => ({ ...l, qrDataUrl: await labelQr(l.activateUrl) })),
  );
  const backHref = back?.startsWith("/") && !back.startsWith("//") ? back : "/devices";

  return (
    <div className="space-y-4">
      <Link href={backHref} className="print-hidden text-sm text-slate-500 hover:text-slate-900">
        ← Back
      </Link>
      <PageHeader
        title="Stamper labels"
        description="Pack one with each stamper. Activation codes are not shown here: they are printed only when stampers are created."
      />
      {withQr.length === 0 ? (
        <EmptyState>No stampers chosen.</EmptyState>
      ) : (
        <LabelSheet labels={withQr} />
      )}
    </div>
  );
}
