import { apiFetch } from "@/lib/api";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { ActivateDeviceForm } from "./ActivateDeviceForm";
import { RevokeDeviceButton } from "./RevokeDeviceButton";

interface Device {
  _id: string;
  deviceIdentifier: string;
  deviceType: string;
  status: string;
  branchId?: { _id: string; name: string } | null;
}

interface Branch {
  _id: string;
  name: string;
}

export default async function DevicesPage({ params }: { params: { businessId: string } }) {
  const [devices, branches] = await Promise.all([
    apiFetch<Device[]>(`/businesses/${params.businessId}/devices`),
    apiFetch<Branch[]>(`/businesses/${params.businessId}/branches`),
  ]);

  return (
    <>
      <PageHeader
        title="Stampers"
        description="Each physical stamper must be activated before it can issue stamps."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {devices.length === 0 ? (
            <EmptyState>
              No stampers yet. Activate the one shipped to you using its code.
            </EmptyState>
          ) : (
            devices.map((device) => (
              <Card key={device._id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-medium">{device.deviceIdentifier}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {device.deviceType}
                      {device.branchId ? ` · ${device.branchId.name}` : " · unassigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={device.status} />
                    {device.status === "ACTIVE" ? (
                      <RevokeDeviceButton
                        businessId={params.businessId}
                        deviceId={device._id}
                        identifier={device.deviceIdentifier}
                      />
                    ) : null}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <ActivateDeviceForm businessId={params.businessId} branches={branches} />
      </div>
    </>
  );
}
