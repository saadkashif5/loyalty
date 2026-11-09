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
  // "\" reads as "/" and tabs are dropped, so "/\evil.com" would leave the site.
  const unsafeChar = [...(back ?? "")].some(
    (c) => c === "\\" || c.charCodeAt(0) < 0x20 || c === "\x7f",
  );
  const backHref =
    back?.startsWith("/") && !back.startsWith("//") && !unsafeChar ? back : "/devices";

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
