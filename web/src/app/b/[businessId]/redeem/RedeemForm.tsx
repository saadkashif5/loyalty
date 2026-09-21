"use client";

import { useFormState, useFormStatus } from "react-dom";
import { validateRedemptionAction } from "@/app/actions/business";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Checking…" : "Validate reward"}
    </Button>
  );
}

export function RedeemForm({ businessId }: { businessId: string }) {
  const action = validateRedemptionAction.bind(null, businessId);
  const [state, formAction] = useFormState(action, {});

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="Redemption code">
          <Input
            name="redemptionCode"
            required
            autoFocus
            autoComplete="off"
            placeholder="e.g. K7M2QP4X"
            className="text-center text-lg uppercase tracking-widest"
          />
        </Field>

        <ErrorText>{state.error}</ErrorText>
        {state.success ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}

        <SubmitButton />
      </form>
    </Card>
  );
}
