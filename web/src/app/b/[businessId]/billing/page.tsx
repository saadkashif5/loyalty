import { apiFetch } from "@/lib/api";
import { Card, PageHeader, StatusBadge, formatDate } from "@/components/ui";

interface Limits {
  branches: number | null;
  programs: number | null;
  stampers: number | null;
  staff: number | null;
  customers: number | null;
}

interface Billing {
  subscription: {
    status: string;
    billingCycle: "MONTHLY" | "ANNUAL";
    plan: {
      code: string;
      name: string;
      priceMonthlyPkr: number;
      priceAnnualPkr: number;
      limits: Limits;
    };
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    graceEndsAt: string | null;
  } | null;
  nextPaymentPkr: number | null;
  usage: Record<keyof Limits, number>;
  payments: Array<{
    _id: string;
    amountPkr: number;
    method: string;
    reference?: string;
    periodStart: string;
    periodEnd: string;
  }>;
  plans: Array<{
    _id: string;
    code: string;
    name: string;
    description?: string;
    priceMonthlyPkr: number;
    priceAnnualPkr: number;
    limits: Limits;
    features: string[];
  }>;
}

const LIMITS: Array<[keyof Limits, string]> = [
  ["branches", "Branches"],
  ["programs", "Active programs"],
  ["stampers", "Active stampers"],
  ["staff", "Staff"],
  ["customers", "Loyalty customers"],
];

const pkr = (n: number) => `PKR ${n.toLocaleString("en-PK")}`;

const STATUS_TEXT: Record<string, string> = {
  TRIALING: "Free trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment due",
  SUSPENDED: "Suspended — unpaid",
  CANCELLED: "Cancelled",
};

export default async function BillingPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const billing = await apiFetch<Billing>(`/businesses/${businessId}/billing`);
  const sub = billing.subscription;

  if (!sub) {
    return (
      <>
        <PageHeader title="Billing" />
        <Card className="text-sm text-slate-600">
          Your business is not on a paid plan. Contact TapTapSell if you have questions.
        </Card>
      </>
    );
  }

  const annual = sub.billingCycle === "ANNUAL";
  const dueBy =
    sub.status === "TRIALING"
      ? sub.trialEndsAt
      : sub.status === "ACTIVE"
        ? sub.currentPeriodEnd
        : sub.graceEndsAt;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Your plan, what you use, and how to pay." />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{sub.plan.name} plan</p>
            <p className="text-sm text-slate-600">
              {pkr(annual ? sub.plan.priceAnnualPkr : sub.plan.priceMonthlyPkr)} per{" "}
              {annual ? "year" : "month"}, plus tax
            </p>
          </div>
          <div className="text-right">
            <StatusBadge status={sub.status} />
            <p className="mt-1 text-xs text-slate-500">{STATUS_TEXT[sub.status]}</p>
          </div>
        </div>
        {dueBy ? (
          <p className="text-sm">
            {sub.status === "TRIALING" && `Your free trial ends on ${formatDate(dueBy)}.`}
            {sub.status === "ACTIVE" && `Paid until ${formatDate(dueBy)}.`}
            {sub.status === "PAST_DUE" &&
              `Payment is overdue. Please pay before ${formatDate(dueBy)} to keep stamping running.`}
          </p>
        ) : null}
        {sub.status === "SUSPENDED" ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            Stamping is paused because payment has not arrived. Customers can still redeem rewards
            they already earned. Pay to switch everything back on straight away.
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-5">
          {LIMITS.map(([key, label]) => {
            const limit = sub.plan.limits[key];
            const used = billing.usage[key];
            const full = limit !== null && used >= limit;
            return (
              <div key={key} className="rounded-md bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`font-medium tabular-nums ${full ? "text-amber-700" : ""}`}>
                  {used} / {limit ?? "unlimited"}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">How to pay</h2>
        <p className="text-sm text-slate-600">
          {billing.nextPaymentPkr
            ? `Your next payment is ${pkr(billing.nextPaymentPkr)} plus tax. `
            : ""}
          Pay by bank transfer or Raast, then send the receipt to the TapTapSell team on WhatsApp or
          email. Your account is updated as soon as we record it.
        </p>
        <p className="text-xs text-slate-500">
          Bank details and online card payment will appear here soon.
        </p>
      </Card>

      <section>
        <h2 className="mb-3 font-semibold">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {billing.plans.map((plan) => (
            <Card
              key={plan._id}
              className={`space-y-2 ${plan.code === sub.plan.code ? "border-brand-500" : ""}`}
            >
              <p className="font-semibold">
                {plan.name}
                {plan.code === sub.plan.code ? (
                  <span className="ml-2 text-xs font-normal text-brand-600">your plan</span>
                ) : null}
              </p>
              <p className="text-sm">{pkr(plan.priceMonthlyPkr)} / month</p>
              <ul className="space-y-0.5 text-xs text-slate-600">
                {LIMITS.map(([key, label]) => (
                  <li key={key}>
                    {label}: {plan.limits[key] ?? "unlimited"}
                  </li>
                ))}
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          To change plan, contact the TapTapSell team. Annual billing is the price of 10 months.
        </p>
      </section>

      {billing.payments.length > 0 ? (
        <Card>
          <h2 className="mb-2 font-semibold">Payments</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {billing.payments.map((p) => (
              <li key={p._id} className="flex flex-wrap justify-between gap-3 py-2">
                <span>
                  {pkr(p.amountPkr)} · {p.method.replace("_", " ").toLowerCase()}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="text-slate-500">
                  covers {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
