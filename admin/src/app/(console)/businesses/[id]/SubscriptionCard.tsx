import { LIMIT_LABELS, type BillingSummary, type Plan } from "@/lib/billing";
import { Card, StatusBadge, formatDate, formatPkr } from "@/components/ui";
import { ChangePlanForm, ExtendTrialForm, RecordPaymentForm } from "./BillingForms";

export function SubscriptionCard({
  businessId,
  billing,
  plans,
  canManage,
}: {
  businessId: string;
  billing: BillingSummary;
  plans: Plan[];
  canManage: boolean;
}) {
  const sub = billing.subscription;
  if (!sub) {
    return (
      <Card className="text-sm text-slate-500">
        No subscription (created before billing). This business has no plan limits.
      </Card>
    );
  }

  const price = sub.billingCycle === "ANNUAL" ? sub.plan.priceAnnualPkr : sub.plan.priceMonthlyPkr;

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Subscription</h2>
          <p className="text-sm text-slate-600">
            {sub.plan.name} (v{sub.plan.version}) · {formatPkr(price)} /
            {sub.billingCycle === "ANNUAL" ? "year" : "month"}
          </p>
          <p className="text-xs text-slate-500">
            {sub.status === "TRIALING"
              ? sub.trialEndsAt
                ? `Trial ends ${formatDate(sub.trialEndsAt)}`
                : "Trial starts when the owner accepts"
              : sub.currentPeriodEnd
                ? `Paid until ${formatDate(sub.currentPeriodEnd)}`
                : "Not paid yet"}
            {sub.graceEndsAt && sub.status === "PAST_DUE"
              ? ` · suspends ${formatDate(sub.graceEndsAt)}`
              : ""}
          </p>
        </div>
        <StatusBadge status={sub.status} />
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-5">
        {LIMIT_LABELS.map(([key, label]) => (
          <div key={key} className="rounded-md bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="font-medium tabular-nums">
              {billing.usage[key]} / {sub.plan.limits[key] ?? "∞"}
            </p>
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="grid gap-6 border-t border-slate-100 pt-4 lg:grid-cols-2">
          <div className="space-y-6">
            <ChangePlanForm
              businessId={businessId}
              plans={plans}
              current={sub.plan.code}
              cycle={sub.billingCycle}
            />
            {!sub.currentPeriodEnd ? <ExtendTrialForm businessId={businessId} /> : null}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Record a payment</h3>
            <RecordPaymentForm businessId={businessId} suggestedAmount={billing.nextPaymentPkr} />
          </div>
        </div>
      ) : null}

      {billing.payments.length > 0 ? (
        <div className="border-t border-slate-100 pt-4">
          <h3 className="mb-2 text-sm font-semibold">Payments</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {billing.payments.map((p) => (
              <li key={p._id} className="flex flex-wrap justify-between gap-3 py-2">
                <span>
                  {formatPkr(p.amountPkr)} · {p.method.replace("_", " ").toLowerCase()}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="text-slate-500">
                  {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
