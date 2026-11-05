import Link from "next/link";
import { redirect } from "next/navigation";
import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import { can, getMemberships } from "@/lib/membership";
import { Card, EmptyState, PageHeader } from "@/components/ui";

// Opened from the QR code on a stamper's label. Sends the owner to the
// activation form of their business, with the stamper ID filled in.
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ device?: string }>;
}) {
  const { device = "" } = await searchParams;
  const deviceId = device.slice(0, 32);
  const businesses = (await getMemberships()).filter(
    (m) => m.business && !m.supportView && can(m.role, BUSINESS_PERMISSIONS.DEVICE_MANAGE),
  );
  const target = (businessId: string) =>
    `/b/${businessId}/devices${deviceId ? `?device=${encodeURIComponent(deviceId)}` : ""}`;

  if (businesses.length === 1) redirect(target(businesses[0]!.business!._id));

  return (
    <main className="mx-auto max-w-xl p-6">
      <PageHeader
        title="Activate a stamper"
        description={deviceId ? `Stamper ${deviceId}` : undefined}
      />
      {businesses.length === 0 ? (
        <EmptyState>
          Only a business owner or manager can activate a stamper. Sign in with that account, or ask
          your owner to do it.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          <p className="text-sm text-slate-500">Which business is this stamper for?</p>
          {businesses.map((m) => (
            <li key={m.business!._id}>
              <Link href={target(m.business!._id)} className="block">
                <Card className="transition hover:border-brand-500">{m.business!.name}</Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
