import { LIMIT_LABELS, type BillingSummary, type Plan } from "@/lib/billing";
import { ApplyCouponForm, CreditNoteForm } from "./CouponForms";
import { removeCouponAction } from "@/app/actions";
import { couponLabel } from "@/lib/billing";
import { Card, SecondaryButton, StatusBadge, formatDate, formatPkr } from "@/components/ui";
import {
  AddChargeForm,
  ChangePlanForm,
  DiscountForm,
  ExtendTrialForm,
  RecordPaymentForm,
  VoidInvoiceForm,
} from "./BillingForms";
import { issueInvoiceAction, removeChargeAction } from "@/app/actions";

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

      {sub.scheduledChange ? (
        <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Moves to {sub.scheduledChange.plan.name} ({sub.scheduledChange.billingCycle.toLowerCase()}
          ) on {formatDate(sub.scheduledChange.effectiveAt)}. A plan change here cancels this.
        </p>
      ) : null}

      {sub.coupon || sub.creditBalancePkr ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {sub.coupon ? (
            <span>
              Coupon <strong>{sub.coupon.code}</strong>: {couponLabel(sub.coupon)}, for{" "}
              {sub.coupon.invoicesLeft} more invoice{sub.coupon.invoicesLeft === 1 ? "" : "s"}
            </span>
          ) : null}
          {sub.coupon && canManage ? (
            <form action={removeCouponAction.bind(null, businessId)}>
              <SecondaryButton type="submit">Remove coupon</SecondaryButton>
            </form>
          ) : null}
          {sub.creditBalancePkr ? (
            <span>Credit for next invoices: {formatPkr(sub.creditBalancePkr)}</span>
          ) : null}
        </div>
      ) : null}

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
            <DiscountForm businessId={businessId} current={sub.discountPercent ?? 0} />
            <ApplyCouponForm businessId={businessId} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Record a payment
              {billing.openInvoice ? ` against ${billing.openInvoice.number}` : ""}
            </h3>
            <RecordPaymentForm
              businessId={businessId}
              suggestedAmount={billing.openInvoice?.totalPkr ?? billing.nextPaymentPkr}
            />
          </div>
        </div>
      ) : null}

      {canManage || sub.pendingCharges.length > 0 ? (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold">Charges for the next invoice</h3>
          {sub.pendingCharges.length > 0 ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {sub.pendingCharges.map((charge) => (
                <li
                  key={charge._id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <span>
                    {charge.description} · {formatPkr(charge.amountPkr)}
                  </span>
                  {canManage ? (
                    <form action={removeChargeAction.bind(null, businessId, charge._id)}>
                      <SecondaryButton type="submit">Remove</SecondaryButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {canManage ? <AddChargeForm businessId={businessId} /> : null}
        </div>
      ) : null}

      <div className="border-t border-slate-100 pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Invoices</h3>
          {canManage && !billing.openInvoice ? (
            <form action={issueInvoiceAction.bind(null, businessId)}>
              <SecondaryButton type="submit">Issue invoice now</SecondaryButton>
            </form>
          ) : null}
        </div>
        {billing.invoices.length === 0 ? (
          <p className="text-sm text-slate-500">
            None yet. The next one is issued automatically a week before the trial or period ends.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {billing.invoices.map((inv) => (
              <li key={inv._id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2">
                  <a
                    href={`/files/invoices/${inv._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-brand-600 hover:underline"
                  >
                    {inv.number}
                  </a>
                  <StatusBadge status={inv.status === "ISSUED" ? "PENDING" : inv.status} />
                  <span className="text-slate-500">
                    {formatPkr(inv.totalPkr)} · due {formatDate(inv.dueDate)}
                  </span>
                </span>
                {canManage && inv.status === "PAID" && inv.totalPkr > 0 ? (
                  <CreditNoteForm
                    businessId={businessId}
                    invoiceId={inv._id}
                    maxPkr={inv.totalPkr}
                  />
                ) : canManage && inv.status === "ISSUED" ? (
                  <VoidInvoiceForm businessId={businessId} invoiceId={inv._id} />
                ) : inv.voidReason ? (
                  <span className="text-xs text-slate-500">Void: {inv.voidReason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {billing.creditNotes?.length ? (
        <div className="border-t border-slate-100 pt-4">
          <h3 className="mb-2 text-sm font-semibold">Credit notes</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {billing.creditNotes.map((n) => (
              <li key={n._id} className="flex flex-wrap justify-between gap-3 py-2">
                <span>
                  <span className="font-mono">{n.number}</span> on {n.invoiceNumber} ·{" "}
                  {formatPkr(n.amountPkr)} ·{" "}
                  {n.outcome === "REFUND" ? "refunded" : "kept as credit"}
                </span>
                <span className="text-slate-500">
                  {n.reason} · {formatDate(n.createdAt)}
                </span>
              </li>
            ))}
          </ul>
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
