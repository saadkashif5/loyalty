"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { manualStampAction } from "@/app/actions/business";
import { ErrorText, SavedText, SecondaryButton, Select } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add a stamp"}
    </SecondaryButton>
  );
}

/** Managers and owners only: a stamp without the customer's code. Always audited. */
export function ManualStampForm({
  businessId,
  cardId,
  branches,
}: {
  businessId: string;
  cardId: string;
  branches: Array<{ _id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(manualStampAction.bind(null, businessId, cardId), {});
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (state.saved) return <SavedText show />;

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {branches.length > 1 ? (
        <Select name="branchId" required className="max-w-[12rem]">
          {branches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </Select>
      ) : (
        <input type="hidden" name="branchId" value={branches[0]?._id ?? ""} />
      )}
      <Submit />
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
