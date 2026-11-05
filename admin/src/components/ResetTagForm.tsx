"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetDeviceTagAction } from "@/app/actions";
import { DangerButton, ErrorText, Input } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <DangerButton type="submit" disabled={pending}>
      {pending ? "Working…" : "Reset tag"}
    </DangerButton>
  );
}

/**
 * Forgets the chip a stamper is bound to, after its tag is re-written or
 * replaced. Folded away so it is not pressed by accident.
 */
export function ResetTagForm({
  deviceId,
  businessId,
  tagUid,
}: {
  deviceId: string;
  businessId: string | null;
  tagUid: string | null;
}) {
  const [state, formAction] = useActionState(
    resetDeviceTagAction.bind(null, deviceId, businessId),
    {},
  );

  if (state.done) return <span className="text-xs text-green-700">Reset. Binds on next tap.</span>;
  if (!tagUid) return <span className="text-xs text-slate-400">Not bound yet</span>;

  return (
    <details>
      <summary className="cursor-pointer font-mono text-xs text-slate-500">{tagUid}</summary>
      <form action={formAction} className="mt-2 w-64 space-y-2">
        <Input
          name="reason"
          required
          minLength={5}
          maxLength={300}
          placeholder="Why (e.g. tag replaced)"
        />
        <p className="text-xs text-slate-500">
          The next tap binds the new chip. Do this just before the new tag goes in.
        </p>
        <ErrorText>{state.error}</ErrorText>
        <Submit />
      </form>
    </details>
  );
}
