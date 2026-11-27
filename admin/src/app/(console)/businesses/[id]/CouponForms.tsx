"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { applyCouponAction, creditNoteAction } from "@/app/actions";
import { PAYMENT_METHODS } from "@/lib/billing";
import { ErrorText, Field, Input, SecondaryButton, Select } from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </SecondaryButton>
  );
}

/** Applies a coupon; the finance team may replace one still in use. */
export function ApplyCouponForm({ businessId }: { businessId: string }) {
  const [state, action] = useActionState(applyCouponAction.bind(null, businessId), {});
  return (
    <form action={action} className="space-y-2">
      <Field label="Apply a coupon">
        <Input name="code" required placeholder="LAUNCH50" className="uppercase" />
      </Field>
      <p className="text-xs text-ink-500">An open invoice is reissued with the coupon.</p>
      <ErrorText>{state.error}</ErrorText>
      {state.done ? <p className="text-sm text-mint-700">Applied.</p> : null}
      <Submit label="Apply" />
    </form>
  );
}

/** Credits part or all of a paid invoice, as a refund or as credit for next time. */
export function CreditNoteForm({
  businessId,
  invoiceId,
  maxPkr,
}: {
  businessId: string;
  invoiceId: string;
  maxPkr: number;
}) {
  const [state, action] = useActionState(creditNoteAction.bind(null, businessId, invoiceId), {});
  if (state.done) return <span className="text-xs text-mint-700">Credit note issued</span>;

  return (
    <details>
      <summary className="cursor-pointer text-xs text-brand-600">Credit note</summary>
      <form action={action} className="mt-2 w-72 space-y-2">
        <Input
          name="amountPkr"
          type="number"
          min={1}
          max={maxPkr}
          required
          placeholder="Amount (PKR)"
        />
        <Input name="reason" required minLength={5} maxLength={500} placeholder="Reason" />
        <Select name="outcome" defaultValue="CREDIT">
          <option value="CREDIT">Keep as credit for the next invoice</option>
          <option value="REFUND">Money sent back</option>
        </Select>
        <Select name="refundMethod" defaultValue="BANK_TRANSFER">
          {PAYMENT_METHODS.filter(([v]) => v !== "CARD" && v !== "OTHER").map(([value, label]) => (
            <option key={value} value={value}>
              Refunded by {label.toLowerCase()}
            </option>
          ))}
        </Select>
        <Input
          name="refundReference"
          maxLength={120}
          placeholder="Refund reference (if refunded)"
        />
        <ErrorText>{state.error}</ErrorText>
        <Submit label="Issue credit note" />
      </form>
    </details>
  );
}
