"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { shipDeviceAction } from "@/app/actions";
import { ErrorText, Input, SecondaryButton } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending}>
      {pending ? "Saving…" : "Mark shipped"}
    </SecondaryButton>
  );
}

/** Records that a stamper has left for the business; its owners are emailed. */
export function ShipForm({ deviceId, businessId }: { deviceId: string; businessId: string }) {
  const [state, formAction] = useActionState(shipDeviceAction.bind(null, deviceId, businessId), {});

  return (
    <details>
      <summary className="cursor-pointer text-xs text-brand-600">Mark shipped</summary>
      <form action={formAction} className="mt-2 w-56 space-y-2">
        <Input name="courier" maxLength={60} placeholder="Courier (e.g. TCS)" />
        <Input name="trackingNumber" maxLength={60} placeholder="Tracking number" />
        <ErrorText>{state.error}</ErrorText>
        <Submit />
      </form>
    </details>
  );
}
