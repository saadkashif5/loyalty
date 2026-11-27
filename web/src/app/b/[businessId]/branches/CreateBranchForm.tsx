"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createBranchAction } from "@/app/actions/business";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Adding…" : "Add branch"}
    </Button>
  );
}

export function CreateBranchForm({ businessId }: { businessId: string }) {
  const action = createBranchAction.bind(null, businessId);
  const [state, formAction] = useActionState(action, {});

  return (
    <Card className="h-fit">
      <h2 className="mb-4 text-sm font-semibold text-ink-700">New branch</h2>
      <form action={formAction} className="space-y-4">
        <Field label="Name">
          <Input name="name" required placeholder="Gulberg Branch" />
        </Field>
        <Field label="Address">
          <Input name="address" placeholder="Main Boulevard, Lahore" />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton />
      </form>
    </Card>
  );
}
