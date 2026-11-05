"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { applyCouponAction } from "@/app/actions/business";
import { ErrorText, Input, SecondaryButton } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending}>
      {pending ? "Checking…" : "Apply"}
    </SecondaryButton>
  );
}

/** Where owners enter a promotion code from TapTapSell. */
export function CouponEntry({ businessId }: { businessId: string }) {
  const [state, action] = useActionState(applyCouponAction.bind(null, businessId), {});
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input
          name="code"
          required
          placeholder="Promotion code"
          className="max-w-[12rem] uppercase"
        />
        <Submit />
      </div>
      <ErrorText>{state.error}</ErrorText>
      {state.saved ? <p className="text-sm text-emerald-700">Code applied.</p> : null}
    </form>
  );
}
