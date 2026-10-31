import { PLATFORM_PERMISSIONS } from "@taptapsell/constants";
import { apiFetch } from "@/lib/api";
import { can, requirePermission } from "@/lib/me";
import { LIMIT_LABELS, type Plan } from "@/lib/billing";
import { Card, PageHeader, StatusBadge, formatPkr } from "@/components/ui";
import { PlanForm } from "./PlanForm";

export default async function PlansPage() {
  const me = await requirePermission(PLATFORM_PERMISSIONS.BILLING_VIEW);
  const canEdit = can(me.platformRole, PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const plans = await apiFetch<Plan[]>("/admin/plans");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Prices exclude tax. Businesses keep the price and limits they signed up with."
      />

      {plans.map((plan) => (
        <Card key={plan._id} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {plan.name} <span className="font-mono text-xs text-slate-400">{plan.code}</span>
              </p>
              <p className="text-sm text-slate-500">
                {formatPkr(plan.priceMonthlyPkr)}/month · {formatPkr(plan.priceAnnualPkr)}/year ·
                version {plan.version}
              </p>
            </div>
            <div className="flex gap-2">
              {plan.isPublic ? null : <StatusBadge status="HIDDEN" />}
              <StatusBadge status={plan.isActive ? "ACTIVE" : "INACTIVE"} />
            </div>
          </div>
          {canEdit ? (
            <details>
              <summary className="cursor-pointer text-sm text-brand-600">Edit</summary>
              <div className="mt-4">
                <PlanForm plan={plan} />
              </div>
            </details>
          ) : (
            <p className="text-sm text-slate-600">
              {LIMIT_LABELS.map(([key, label]) => `${label}: ${plan.limits[key] ?? "∞"}`).join(
                " · ",
              )}
            </p>
          )}
        </Card>
      ))}

      {canEdit ? (
        <Card>
          <h2 className="mb-4 font-semibold">New plan</h2>
          <PlanForm />
        </Card>
      ) : null}
    </div>
  );
}
