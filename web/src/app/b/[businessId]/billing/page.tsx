import { BRAND } from "@taptapsell/brand";
import { apiFetch } from "@/lib/api";
import { Card, PageHeader, StatusBadge, formatDate } from "@/components/ui";
import { CancelChangeForm, ChangePlanButton, type PlanChangeQuote } from "./PlanActions";
import { CouponEntry } from "./CouponEntry";
import { UploadReceiptForm } from "./UploadReceiptForm";

interface Limits {
  branches: number | null;
  programs: number | null;
  stampers: number | null;
  staff: number | null;
  customers: number | null;
}

interface Invoice {
  _id: string;
  number: string;
  status: "ISSUED" | "PAID" | "VOID";
  issuedAt: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  totalPkr: number;
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
    pendingCharges: Array<{ _id: string; description: string; amountPkr: number }>;
    scheduledChange: {
      plan: { name: string };
      billingCycle: "MONTHLY" | "ANNUAL";
      effectiveAt: string;
    } | null;
    coupon?: {
      code: string;
      percentOff: number | null;
      amountOffPkr: number | null;
      invoicesLeft: number;
    } | null;
    creditBalancePkr?: number;
  } | null;
  creditNotes?: Array<{
    _id: string;
    number: string;
    invoiceNumber: string;
    amountPkr: number;
    reason: string;
    outcome: "REFUND" | "CREDIT";
    createdAt: string;
  }>;
  nextPaymentPkr: number | null;
  planChanges: Record<string, PlanChangeQuote>;
  openInvoice: Invoice | null;
  invoices: Invoice[];
  proofs: Array<{
    _id: string;
    invoiceId: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    amountPkr: number;
    createdAt: string;
    rejectionReason?: string;
  }>;
  paymentDetails: {
    companyName: string;
    bankAccounts: Array<{
      bankName: string;
      accountTitle: string;
      accountNumber: string;
      iban?: string;
    }>;
    raastId: string | null;
    instructions: string | null;
    email: string | null;
    phone: string | null;
  };
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
          Your business is not on a paid plan. Contact {BRAND.name} if you have questions.
        </Card>
      </>
    );
  }

  const annual = sub.billingCycle === "ANNUAL";
  const open = billing.openInvoice;
  const pendingProof = open
    ? billing.proofs.find((p) => p.invoiceId === open._id && p.status === "PENDING")
    : undefined;
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

        {sub.scheduledChange ? (
          <div className="space-y-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
            <p>
              You move to the {sub.scheduledChange.plan.name} plan (
              {sub.scheduledChange.billingCycle === "ANNUAL" ? "yearly" : "monthly"}) on{" "}
              {formatDate(sub.scheduledChange.effectiveAt)}.
            </p>
            <CancelChangeForm businessId={businessId} />
          </div>
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

      <Card className="space-y-4">
        <h2 className="font-semibold">How to pay</h2>
        {open ? (
          <p className="text-sm">
            Invoice{" "}
            <a
              href={`/b/${businessId}/billing/invoices/${open._id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-brand-600 hover:underline"
            >
              {open.number}
            </a>{" "}
            for <strong>{pkr(open.totalPkr)}</strong> (tax included) is due on{" "}
            {formatDate(open.dueDate)}.
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            {billing.nextPaymentPkr
              ? `Your next payment is ${pkr(billing.nextPaymentPkr)} plus tax. `
              : ""}
            We email an invoice a week before it is due.
          </p>
        )}

        {sub.pendingCharges.length > 0 ? (
          <div className="text-sm">
            <p className="font-medium">On your next invoice</p>
            <ul className="text-slate-600">
              {sub.pendingCharges.map((charge) => (
                <li key={charge._id}>
                  {charge.description}: {pkr(charge.amountPkr)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <PaymentDetails details={billing.paymentDetails} reference={open?.number} />

        {open ? (
          pendingProof ? (
            <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
              We received your receipt for {pkr(pendingProof.amountPkr)} on{" "}
              {formatDate(pendingProof.createdAt)} and are checking it.
            </p>
          ) : (
            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-1 text-sm font-semibold">Already paid? Send us the receipt</h3>
              <p className="mb-3 text-xs text-slate-500">
                A screenshot from your banking app is fine. We match it to our bank statement.
              </p>
              <UploadReceiptForm
                businessId={businessId}
                invoiceId={open._id}
                amountPkr={open.totalPkr}
              />
            </div>
          )
        ) : null}
      </Card>

      {billing.proofs.length > 0 ? (
        <Card>
          <h2 className="mb-2 font-semibold">Receipts you sent</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {billing.proofs.map((proof) => (
              <li key={proof._id} className="space-y-1 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {pkr(proof.amountPkr)} · sent {formatDate(proof.createdAt)}
                  </span>
                  <StatusBadge status={proof.status} />
                </div>
                {proof.rejectionReason ? (
                  <p className="text-xs text-red-700">Not accepted: {proof.rejectionReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <h2 className="font-semibold">Promotion code</h2>
        {billing.subscription?.coupon ? (
          <p className="text-sm text-emerald-800">
            {billing.subscription.coupon.code}:{" "}
            {billing.subscription.coupon.percentOff
              ? `${billing.subscription.coupon.percentOff}% off`
              : `${pkr(billing.subscription.coupon.amountOffPkr ?? 0)} off`}{" "}
            your plan for the next {billing.subscription.coupon.invoicesLeft} invoice
            {billing.subscription.coupon.invoicesLeft === 1 ? "" : "s"}.
          </p>
        ) : (
          <CouponEntry businessId={businessId} />
        )}
        {billing.subscription?.creditBalancePkr ? (
          <p className="text-sm text-emerald-800">
            You have {pkr(billing.subscription.creditBalancePkr)} of credit. It comes off your next
            invoice.
          </p>
        ) : null}
      </Card>

      {billing.creditNotes?.length ? (
        <Card>
          <h2 className="mb-2 font-semibold">Credit notes</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {billing.creditNotes.map((n) => (
              <li key={n._id} className="flex flex-wrap justify-between gap-3 py-2">
                <span>
                  <span className="font-mono">{n.number}</span> on {n.invoiceNumber} ·{" "}
                  {pkr(n.amountPkr)} {n.outcome === "REFUND" ? "refunded" : "credited"}
                </span>
                <span className="text-slate-500">
                  {n.reason} · {formatDate(n.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {billing.invoices.length > 0 ? (
        <Card>
          <h2 className="mb-2 font-semibold">Invoices</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {billing.invoices.map((inv) => (
              <li key={inv._id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2">
                  <a
                    href={`/b/${businessId}/billing/invoices/${inv._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-brand-600 hover:underline"
                  >
                    {inv.number}
                  </a>
                  <StatusBadge status={inv.status} />
                </span>
                <span className="text-slate-500">
                  {pkr(inv.totalPkr)} · {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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
              <p className="text-sm">
                {annual
                  ? `${pkr(plan.priceAnnualPkr)} / year`
                  : `${pkr(plan.priceMonthlyPkr)} / month`}
              </p>
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
              {billing.planChanges[`${plan.code}:${sub.billingCycle}`] ? (
                <ChangePlanButton
                  businessId={businessId}
                  planCode={plan.code}
                  billingCycle={sub.billingCycle as "MONTHLY" | "ANNUAL"}
                  label={`Switch to ${plan.name}`}
                  quote={billing.planChanges[`${plan.code}:${sub.billingCycle}`]!}
                />
              ) : null}
            </Card>
          ))}
        </div>
        {billing.planChanges[`${sub.plan.code}:${annual ? "MONTHLY" : "ANNUAL"}`] ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-slate-500">Annual billing is the price of 10 months.</p>
            <ChangePlanButton
              businessId={businessId}
              planCode={sub.plan.code}
              billingCycle={annual ? "MONTHLY" : "ANNUAL"}
              label={annual ? "Switch to monthly billing" : "Switch to annual billing"}
              quote={billing.planChanges[`${sub.plan.code}:${annual ? "MONTHLY" : "ANNUAL"}`]!}
            />
          </div>
        ) : null}
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

function PaymentDetails({
  details,
  reference,
}: {
  details: Billing["paymentDetails"];
  reference?: string;
}) {
  if (details.bankAccounts.length === 0 && !details.raastId) {
    return (
      <p className="text-sm text-slate-600">
        Contact the {BRAND.name} team
        {details.phone ? ` on ${details.phone}` : details.email ? ` at ${details.email}` : ""} for
        payment details.
      </p>
    );
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        {details.bankAccounts.map((account) => (
          <div key={account.accountNumber} className="rounded-md bg-slate-50 px-3 py-2">
            <p className="font-medium">{account.bankName}</p>
            <p className="text-slate-600">{account.accountTitle}</p>
            <p className="font-mono text-xs">{account.accountNumber}</p>
            {account.iban ? <p className="font-mono text-xs">{account.iban}</p> : null}
          </div>
        ))}
        {details.raastId ? (
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <p className="font-medium">Raast</p>
            <p className="font-mono text-xs">{details.raastId}</p>
          </div>
        ) : null}
      </div>
      {reference ? (
        <p className="text-slate-600">
          Write <span className="font-mono">{reference}</span> in the transfer description so we can
          match your payment.
        </p>
      ) : null}
      {details.instructions ? (
        <p className="whitespace-pre-line text-slate-600">{details.instructions}</p>
      ) : null}
    </div>
  );
}
