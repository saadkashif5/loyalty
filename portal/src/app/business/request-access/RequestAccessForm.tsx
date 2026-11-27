"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestAccessAction } from "@/app/actions";
import { ErrorText, Field, Input } from "@/components/ui";

const CATEGORIES: Array<[string, string]> = [
  ["CAFE", "Café"],
  ["RESTAURANT", "Restaurant"],
  ["BAKERY", "Bakery"],
  ["SALON", "Salon"],
  ["BARBER", "Barber"],
  ["GYM", "Gym"],
  ["RETAIL", "Shop"],
  ["OTHER", "Something else"],
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand-600 py-3 font-medium text-white disabled:opacity-60"
    >
      {pending ? "Sending…" : "Request access"}
    </button>
  );
}

export function RequestAccessForm({ plan }: { plan?: string }) {
  const [state, action] = useActionState(requestAccessAction, {});

  if (state.sent) {
    return (
      <div className="rounded-2xl bg-mint-50 p-6 text-mint-900">
        <p className="text-lg font-semibold">Thank you!</p>
        <p className="mt-1">We have your details and will call you soon to set things up.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}
      {/* Left empty by people; bots fill it in and are quietly ignored. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />
      <Field label="Business name">
        <Input name="businessName" required maxLength={160} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind of business">
          <select
            name="category"
            defaultValue="CAFE"
            className="w-full rounded-xl border border-ink-300 bg-white px-3 py-3"
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <Input name="city" required maxLength={80} placeholder="Lahore" />
        </Field>
        <Field label="Your name">
          <Input name="contactName" required maxLength={120} />
        </Field>
        <Field label="Mobile number">
          <Input name="phone" type="tel" required placeholder="0300 1234567" />
        </Field>
        <Field label="Email (optional)">
          <Input name="email" type="email" />
        </Field>
        <Field label="Number of branches">
          <Input name="branches" type="number" min={1} max={1000} defaultValue={1} />
        </Field>
      </div>
      <Field label="Anything we should know? (optional)">
        <textarea
          name="message"
          rows={3}
          maxLength={1000}
          className="w-full rounded-xl border border-ink-300 px-3 py-3"
        />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <Submit />
    </form>
  );
}
