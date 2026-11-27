"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { reportDeviceProblemAction } from "@/app/actions/business";
import { ErrorText, Field, Input, SecondaryButton, Select } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send report"}
    </SecondaryButton>
  );
}

export function ReportProblemForm({
  businessId,
  deviceId,
}: {
  businessId: string;
  deviceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    reportDeviceProblemAction.bind(null, businessId, deviceId),
    {},
  );

  if (state.saved) return <p className="text-sm text-mint-700">Report sent.</p>;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-ink-500 hover:text-ink-900"
      >
        Report a problem
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-ink-100 pt-3">
      <Field label="What happened?">
        <Select name="reason" defaultValue="NOT_WORKING">
          <option value="NOT_WORKING">It is not working</option>
          <option value="DAMAGED">It is damaged</option>
          <option value="LOST">It is lost or stolen — stop it now</option>
        </Select>
      </Field>
      <Field label="Details (optional)">
        <Input name="note" maxLength={500} />
      </Field>
      <p className="text-xs text-ink-500">
        A lost stamper is switched off at once so nobody else can use it.
      </p>
      <ErrorText>{state.error}</ErrorText>
      <Submit />
    </form>
  );
}
