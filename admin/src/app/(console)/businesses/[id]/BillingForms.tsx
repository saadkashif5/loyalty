"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addChargeAction,
  changeSubscriptionPlanAction,
  extendTrialAction,
  recordPaymentAction,
  setDiscountAction,
  voidInvoiceAction,
} from "@/app/actions";
import { PAYMENT_METHODS, type Plan } from "@/lib/billing";
import { ErrorText, Field, Input, SecondaryButton, Select } from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </SecondaryButton>
  );
}

function Done({ show, text }: { show?: boolean; text: string }) {
  return show ? <p className="text-sm text-emerald-700">{text}</p> : null;
}

export function ChangePlanForm({
  businessId,
  plans,
  current,
  cycle,
}: {
  businessId: string;
  plans: Plan[];
  current: string;
  cycle: string;
}) {
  const [state, action] = useActionState(changeSubscriptionPlanAction.bind(null, businessId), {});
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Plan">
          <Select name="planCode" defaultValue={current}>
            {plans
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p._id} value={p.code}>
                  {p.name}
                  {p.isPublic ? "" : " (hidden)"}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Billing">
          <Select name="billingCycle" defaultValue={cycle}>
            <option value="MONTHLY">Monthly</option>
            <option value="ANNUAL">Annual</option>
          </Select>
        </Field>
      </div>
      <p className="text-xs text-slate-500">Takes effect now, at the plan&apos;s current price.</p>
      <ErrorText>{state.error}</ErrorText>
      <Done show={state.done} text="Plan changed." />
      <Submit label="Change plan" />
    </form>
  );
}

export function ExtendTrialForm({ businessId }: { businessId: string }) {
  const [state, action] = useActionState(extendTrialAction.bind(null, businessId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Extra trial days">
        <Input name="days" type="number" min={1} max={90} defaultValue={14} className="w-24" />
      </Field>
      <Submit label="Extend trial" />
      <ErrorText>{state.error}</ErrorText>
      <Done show={state.done} text="Trial extended." />
    </form>
  );
}

export function RecordPaymentForm({
  businessId,
  suggestedAmount,
}: {
  businessId: string;
  suggestedAmount: number | null;
}) {
  const [state, action] = useActionState(recordPaymentAction.bind(null, businessId), {});
  if (state.done)
    return <Done show text="Payment recorded. The owner has been emailed a receipt." />;

  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Amount (PKR)">
          <Input
            name="amountPkr"
            type="number"
            min={1}
            required
            defaultValue={suggestedAmount ?? undefined}
          />
        </Field>
        <Field label="Method">
          <Select name="method" defaultValue="BANK_TRANSFER">
            {PAYMENT_METHODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Periods paid">
          <Input name="periods" type="number" min={1} max={24} defaultValue={1} />
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Reference (transaction ID, cheque no.)">
          <Input name="reference" maxLength={120} />
        </Field>
        <Field label="Note">
          <Input name="note" maxLength={500} />
        </Field>
      </div>
      <ErrorText>{state.error}</ErrorText>
      <Submit label="Record payment" />
    </form>
  );
}

export function AddChargeForm({ businessId }: { businessId: string }) {
  const [state, action] = useActionState(addChargeAction.bind(null, businessId), {});
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Type">
          <Select name="kind" defaultValue="HARDWARE">
            <option value="HARDWARE">Hardware</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Description">
          <Input name="description" required minLength={3} placeholder="NFC stamper" />
        </Field>
        <Field label="Quantity">
          <Input name="quantity" type="number" min={1} defaultValue={1} required />
        </Field>
        <Field label="Unit price (PKR)">
          <Input name="unitPkr" type="number" min={1} required />
        </Field>
      </div>
      <Submit label="Add to next invoice" />
      <ErrorText>{state.error}</ErrorText>
      <Done show={state.done} text="Added. Hardware is never discounted." />
    </form>
  );
}

export function DiscountForm({ businessId, current }: { businessId: string; current: number }) {
  const [state, action] = useActionState(setDiscountAction.bind(null, businessId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Discount on future invoices (%)">
        <Input
          name="discountPercent"
          type="number"
          min={0}
          max={100}
          defaultValue={current}
          className="w-24"
        />
      </Field>
      <Submit label="Set discount" />
      <ErrorText>{state.error}</ErrorText>
      <Done show={state.done} text="Saved. 100% makes the account complimentary." />
    </form>
  );
}

export function VoidInvoiceForm({
  businessId,
  invoiceId,
}: {
  businessId: string;
  invoiceId: string;
}) {
  const [state, action] = useActionState(voidInvoiceAction.bind(null, businessId, invoiceId), {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input
        name="reason"
        required
        minLength={3}
        placeholder="Reason for voiding"
        className="w-56"
      />
      <SecondaryButton type="submit">Void</SecondaryButton>
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
