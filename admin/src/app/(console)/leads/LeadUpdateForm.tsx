"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { updateLeadAction } from "@/app/actions";
import { ErrorText, Input, SecondaryButton, Select } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </SecondaryButton>
  );
}

export function LeadUpdateForm({ leadId, status }: { leadId: string; status: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(async (prev: object, formData: FormData) => {
    const result = await updateLeadAction(leadId, prev, formData);
    if (result.done) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
      <Select name="status" defaultValue={status} className="max-w-[10rem]">
        <option value="NEW">New</option>
        <option value="CONTACTED">Contacted</option>
        <option value="REJECTED">Rejected</option>
        {status === "CONVERTED" ? <option value="CONVERTED">Converted</option> : null}
      </Select>
      <Input
        name="note"
        placeholder="Add a note (optional)"
        maxLength={1000}
        className="min-w-[14rem] flex-1"
      />
      <Submit />
      <ErrorText>{"error" in state ? (state.error as string) : null}</ErrorText>
    </form>
  );
}
