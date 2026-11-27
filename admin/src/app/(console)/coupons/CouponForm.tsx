"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCouponAction } from "@/app/actions";
import { Button, ErrorText, Field, Input, Select } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create coupon"}
    </Button>
  );
}

export function CouponForm() {
  const [state, action] = useActionState(createCouponAction, {});
  return (
    <form action={action} className="space-y-3">
      <h2 className="font-semibold">New coupon</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Code">
          <Input name="code" required placeholder="LAUNCH50" className="uppercase" />
        </Field>
        <Field label="Kind">
          <Select name="kind" defaultValue="PERCENT">
            <option value="PERCENT">Percentage off</option>
            <option value="AMOUNT">PKR off</option>
          </Select>
        </Field>
        <Field label="Value">
          <Input name="value" type="number" min={1} required placeholder="50" />
        </Field>
        <Field label="Invoices it applies to">
          <Input name="invoices" type="number" min={1} max={24} defaultValue={1} />
        </Field>
        <Field label="Plans (codes, comma separated)">
          <Input name="planCodes" placeholder="Any plan" />
        </Field>
        <Field label="Most businesses">
          <Input name="maxRedemptions" type="number" min={1} placeholder="No limit" />
        </Field>
        <Field label="Expires">
          <Input name="expiresAt" type="date" />
        </Field>
        <Field label="Note">
          <Input name="description" maxLength={200} placeholder="Launch offer" />
        </Field>
      </div>
      <ErrorText>{state.error}</ErrorText>
      {state.done ? <p className="text-sm text-mint-700">Created.</p> : null}
      <Submit />
    </form>
  );
}
