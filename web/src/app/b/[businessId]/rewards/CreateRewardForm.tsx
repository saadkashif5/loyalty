"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createRewardAction } from "@/app/actions/business";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";

const REWARD_TYPES = [
  { value: "FREE_ITEM", label: "Free item" },
  { value: "PERCENT_OFF", label: "Percentage off" },
  { value: "FIXED_DISCOUNT", label: "Fixed discount (PKR)" },
  { value: "OTHER", label: "Other" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creating…" : "Create reward"}
    </Button>
  );
}

export function CreateRewardForm({
  businessId,
  programs,
}: {
  businessId: string;
  programs: { _id: string; name: string; requiredStamps: number }[];
}) {
  const action = createRewardAction.bind(null, businessId);
  const [state, formAction] = useActionState(action, {});

  if (programs.length === 0) {
    return (
      <Card className="h-fit text-sm text-ink-500">
        Create a loyalty program first — every reward belongs to one.
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <h2 className="mb-4 text-sm font-semibold text-ink-700">New reward</h2>
      <form action={formAction} className="space-y-4">
        <Field label="Program">
          <select
            name="programId"
            required
            className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm"
          >
            {programs.map((program) => (
              <option key={program._id} value={program._id}>
                {program.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name">
          <Input name="name" required placeholder="Free Coffee" />
        </Field>
        <Field label="Description">
          <Input name="description" placeholder="Any regular size drink" />
        </Field>
        <Field label="Type">
          <select name="type" className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm">
            {REWARD_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stamps required">
          <Input
            name="requiredStamps"
            type="number"
            min={1}
            max={100}
            defaultValue={programs[0]?.requiredStamps ?? 9}
            required
          />
        </Field>
        <Field label="Days to use it (blank = never expires)">
          <Input name="validForDays" type="number" min={1} max={365} placeholder="e.g. 30" />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton />
      </form>
    </Card>
  );
}
