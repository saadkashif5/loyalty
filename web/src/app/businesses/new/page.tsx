"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createBusinessAction } from "@/app/actions/business";
import { Button, Card, ErrorText, Field, Input, PageHeader } from "@/components/ui";

const CATEGORIES = ["CAFE", "RESTAURANT", "BAKERY", "SALON", "BARBER", "GYM", "RETAIL", "OTHER"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creating…" : "Create business"}
    </Button>
  );
}

export default function NewBusinessPage() {
  const [state, formAction] = useActionState(createBusinessAction, {});

  return (
    <main className="mx-auto max-w-md p-6">
      <PageHeader title="Add a business" description="You will be its owner." />
      <Card>
        <form action={formAction} className="space-y-4">
          <Field label="Business name">
            <Input name="name" required placeholder="Chai Wala Cafe" />
          </Field>
          <Field label="Category">
            <select
              name="category"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <Input name="description" placeholder="Specialty coffee in Gulberg" />
          </Field>
          <ErrorText>{state.error}</ErrorText>
          <SubmitButton />
        </form>
      </Card>
    </main>
  );
}
