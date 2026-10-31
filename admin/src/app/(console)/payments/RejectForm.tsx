"use client";

import { useActionState, useState } from "react";
import { approveProofAction, rejectProofAction } from "@/app/actions";
import { Button, DangerButton, ErrorText, Input } from "@/components/ui";

export function ApproveForm({ proofId }: { proofId: string }) {
  const [state, action] = useActionState(approveProofAction.bind(null, proofId), {});
  return (
    <form action={action} className="flex items-center gap-2">
      <Button type="submit">Approve</Button>
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}

export function RejectForm({ proofId }: { proofId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(rejectProofAction.bind(null, proofId), {});

  if (!open) {
    return (
      <DangerButton type="button" onClick={() => setOpen(true)}>
        Reject
      </DangerButton>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input
        name="reason"
        required
        minLength={3}
        maxLength={500}
        placeholder="Why? The owner is emailed this."
        className="min-w-[16rem]"
      />
      <DangerButton type="submit">Reject receipt</DangerButton>
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
