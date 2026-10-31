"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateBusinessProfileAction } from "@/app/actions/business";
import { Button, ErrorText, Field, Input, SavedText, Select, Textarea } from "@/components/ui";

const CATEGORIES = [
  ["CAFE", "Café"],
  ["RESTAURANT", "Restaurant"],
  ["BAKERY", "Bakery"],
  ["SALON", "Salon"],
  ["BARBER", "Barber"],
  ["GYM", "Gym"],
  ["RETAIL", "Retail"],
  ["OTHER", "Other"],
] as const;

export interface BusinessProfile {
  name: string;
  category: string;
  description?: string;
  contact?: { phone?: string; email?: string; address?: string };
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function BusinessProfileForm({
  businessId,
  profile,
}: {
  businessId: string;
  profile: BusinessProfile;
}) {
  const [state, formAction] = useActionState(
    updateBusinessProfileAction.bind(null, businessId),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <Input name="name" required defaultValue={profile.name} />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue={profile.category}>
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Phone customers can call">
          <Input
            name="phone"
            required
            inputMode="tel"
            placeholder="042 35761234"
            defaultValue={profile.contact?.phone}
          />
        </Field>
        <Field label="Email (optional)">
          <Input name="email" type="email" defaultValue={profile.contact?.email} />
        </Field>
      </div>
      <Field label="Address">
        <Input
          name="address"
          required
          placeholder="Shop 4, MM Alam Road, Gulberg III, Lahore"
          defaultValue={profile.contact?.address}
        />
      </Field>
      <Field label="Short description (shown to customers)">
        <Textarea name="description" rows={2} maxLength={2000} defaultValue={profile.description} />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <SavedText show={state.saved} />
      <Submit />
    </form>
  );
}
