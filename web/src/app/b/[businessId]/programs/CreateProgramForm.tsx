"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createProgramAction } from "@/app/actions/business";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creating…" : "Create program"}
    </Button>
  );
}

export function CreateProgramForm({ businessId }: { businessId: string }) {
  const action = createProgramAction.bind(null, businessId);
  const [state, formAction] = useActionState(action, {});

  return (
    <Card className="h-fit">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">New program</h2>
      <form action={formAction} className="space-y-4">
        <Field label="Name">
          <Input name="name" required placeholder="Coffee Rewards" />
        </Field>
        <Field label="Description">
          <Input name="description" placeholder="Buy 9, get the 10th free" />
        </Field>
        <Field label="Stamps required">
          <Input name="requiredStamps" type="number" min={1} max={100} defaultValue={9} required />
        </Field>
        <Field label="Minutes between stamps">
          <Input name="minMinutesBetweenStamps" type="number" min={0} max={1440} defaultValue={5} />
        </Field>
        <Field label="Most stamps per card per day">
          <Input name="maxStampsPerDay" type="number" min={1} max={50} defaultValue={3} />
        </Field>
        <p className="text-xs text-slate-500">
          The cooldown and daily limit stop one purchase turning into several stamps.
        </p>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton />
      </form>
    </Card>
  );
}
