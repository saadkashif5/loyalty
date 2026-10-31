import { BUSINESS_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { can, getMembership } from "@/lib/membership";
import { Card, EmptyState, PageHeader, StatusBadge, formatDate } from "@/components/ui";
import { ReportProblemForm } from "./ReportProblemForm";
import { ActivateDeviceForm } from "./ActivateDeviceForm";
import { RevokeDeviceButton } from "./RevokeDeviceButton";

interface Device {
  _id: string;
  deviceIdentifier: string;
  deviceType: string;
  status: string;
  branchId?: { _id: string; name: string } | null;
  lastProblem?: { reason?: string; note?: string; at?: string } | null;
}

const PROBLEM_LABEL: Record<string, string> = {
  LOST: "reported lost",
  DAMAGED: "reported damaged",
  NOT_WORKING: "reported not working",
};

interface Branch {
  _id: string;
  name: string;
}

export default async function DevicesPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { role } = await getMembership(businessId);
  const canManage = can(role, BUSINESS_PERMISSIONS.DEVICE_MANAGE);
  const [devices, branches] = await Promise.all([
    apiFetch<Device[]>(`/businesses/${businessId}/devices`),
    apiFetch<Branch[]>(`/businesses/${businessId}/branches`),
  ]);

  return (
    <>
      <PageHeader
        title="Stampers"
        description="Each physical stamper must be activated before it can issue stamps."
      />

      <div className={`grid gap-6 ${canManage ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
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
                    {canManage && device.status === "ACTIVE" ? (
                      <RevokeDeviceButton
                        businessId={businessId}
                        deviceId={device._id}
                        identifier={device.deviceIdentifier}
                      />
                    ) : null}
                  </div>
                </div>
                {device.lastProblem?.reason ? (
                  <p className="mt-2 text-sm text-amber-700">
                    {PROBLEM_LABEL[device.lastProblem.reason]} {formatDate(device.lastProblem.at)}
                    {device.lastProblem.note ? ` — ${device.lastProblem.note}` : ""}
                  </p>
                ) : null}
                {device.status === "ACTIVE" ? (
                  <ReportProblemForm businessId={businessId} deviceId={device._id} />
                ) : null}
              </Card>
            ))
          )}
        </div>

        {canManage ? <ActivateDeviceForm businessId={businessId} branches={branches} /> : null}
      </div>
    </>
  );
}
