"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateStaffCapAction } from "@/app/actions/business";
import { Button, ErrorText, Field, Input, SavedText } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function StaffCapForm({
  businessId,
  cap,
  approvalAfter,
}: {
  businessId: string;
  cap: number;
  approvalAfter?: number | null;
}) {
  const [state, formAction] = useActionState(updateStaffCapAction.bind(null, businessId), {});

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Most stamps one staff member can add per day">
        <Input
          name="staffDailyStampCap"
          type="number"
          min={1}
          max={1000}
          required
          defaultValue={cap}
          className="max-w-[8rem]"
        />
      </Field>
      <p className="text-xs text-ink-500">
        Counts stamps added at the counter and by search. Reaching it raises an alert.
      </p>
      <Field label="Ask a manager to approve a staff member's counter stamps after this many a day (blank = never)">
        <Input
          name="stampApprovalAfter"
          type="number"
          min={1}
          max={1000}
          placeholder="Never"
          defaultValue={approvalAfter ?? undefined}
          className="max-w-[8rem]"
        />
      </Field>
      <p className="text-xs text-ink-500">
        Waiting stamps appear under Approvals. Managers and owners are never held.
      </p>
      <ErrorText>{state.error}</ErrorText>
      <SavedText show={state.saved} />
      <Submit />
    </form>
  );
}
