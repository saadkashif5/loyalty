"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction } from "@/app/actions";
import { Card, ErrorText, Field, Input } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand-600 py-3 font-medium text-white disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function ProfileForm({ name, phone }: { name: string; phone?: string | null }) {
  const [state, action] = useActionState(updateProfileAction, {});
  return (
    <Card>
      <form action={action} className="space-y-3">
        <Field label="Name">
          <Input name="name" required maxLength={120} defaultValue={name} />
        </Field>
        <Field label="Mobile number (optional)">
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="0300 1234567"
            defaultValue={phone ? `0${phone.slice(3)}` : ""}
          />
        </Field>
        <p className="text-xs text-slate-500">
          Only needed if you want shops to send you offers on WhatsApp. Leave it blank to remove it.
        </p>
        <ErrorText>{state.error}</ErrorText>
        {state.saved ? <p className="text-sm text-emerald-700">Saved.</p> : null}
        <Submit />
      </form>
    </Card>
  );
}
