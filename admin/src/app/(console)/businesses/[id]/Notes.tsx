"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addNoteAction } from "@/app/actions";
import { Button, ErrorText, Textarea } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Add note"}
    </Button>
  );
}

/** Adds a support note; notes are kept as written, newest first. */
export function AddNoteForm({ businessId }: { businessId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    async (prev: { error?: string; done?: boolean }, formData: FormData) => {
      const result = await addNoteAction(businessId, prev, formData);
      if (result.done) form.current?.reset();
      return result;
    },
    {},
  );

  return (
    <form ref={form} action={formAction} className="space-y-2">
      <Textarea
        name="body"
        required
        rows={2}
        maxLength={2000}
        placeholder="What happened, what was agreed, what to check next time"
      />
      <ErrorText>{state.error}</ErrorText>
      <Submit />
    </form>
  );
}
